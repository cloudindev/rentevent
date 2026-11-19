"use client";
/**
 * Offline outbox for the worker app. Clock-ins/outs, photos and job reports
 * are executed immediately when online; when the network fails they are
 * stored in IndexedDB and replayed later, preserving their original time.
 * Job reports carry a clientRef so a replay is idempotent on the server.
 */
import { clockIn, clockOut, submitJobReport } from "@/server/actions/crew";

const DB = "rentevent-m";
const STORE = "outbox";
const PHOTOS = "photoKeys";

export type OutboxKind = "clockIn" | "clockOut" | "photo" | "report";
export type PhotoRef = { key?: string; localId?: string; stage: "inicio" | "fin" };
type ClockInPayload = { shiftId: string | null; lat: number | null; lng: number | null; at: string };
type ClockOutPayload = { lat: number | null; lng: number | null; at: string; breakMinutes: number; diet: boolean };
type PhotoPayload = { localId: string; shiftId: string; stage: "inicio" | "fin"; blob: Blob };
type ReportPayload = Omit<Parameters<typeof submitJobReport>[0], "photos"> & { photos: PhotoRef[] };
export type OutboxItem =
  | { id: string; kind: "clockIn"; payload: ClockInPayload; createdAt: number; error?: string }
  | { id: string; kind: "clockOut"; payload: ClockOutPayload; createdAt: number; error?: string }
  | { id: string; kind: "photo"; payload: PhotoPayload; createdAt: number; error?: string }
  | { id: string; kind: "report"; payload: ReportPayload; createdAt: number; error?: string };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(PHOTOS)) db.createObjectStore(PHOTOS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const r = fn(t.objectStore(store));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export const listOutbox = () => tx<OutboxItem[]>(STORE, "readonly", (s) => s.getAll() as IDBRequest<OutboxItem[]>).catch(() => [] as OutboxItem[]);
const putItem = (item: OutboxItem) => tx(STORE, "readwrite", (s) => s.put(item));
const removeItem = (id: string) => tx(STORE, "readwrite", (s) => s.delete(id));
const setPhotoKey = (localId: string, key: string) => tx(PHOTOS, "readwrite", (s) => s.put(key, localId));
const getPhotoKey = (localId: string) => tx<string | undefined>(PHOTOS, "readonly", (s) => s.get(localId) as IDBRequest<string | undefined>);

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

function notifyChange() {
  window.dispatchEvent(new Event("rv-outbox"));
}

/** A thrown error that means "network unavailable", not a validation error. */
const isNetworkError = (e: unknown) => !navigator.onLine || e instanceof TypeError || (e instanceof Error && /fetch|network|Failed to/i.test(e.message));

export async function enqueue(item: Omit<OutboxItem, "id" | "createdAt">) {
  await putItem({ ...item, id: uid(), createdAt: Date.now() } as OutboxItem);
  notifyChange();
}

async function uploadPhoto(p: PhotoPayload): Promise<string> {
  const fd = new FormData();
  fd.set("file", p.blob, `${p.stage}.jpg`);
  fd.set("shiftId", p.shiftId);
  fd.set("stage", p.stage);
  const res = await fetch("/m/foto", { method: "POST", body: fd });
  const j = (await res.json()) as { key?: string; error?: string };
  if (!res.ok || !j.key) throw new Error(j.error ?? "No se pudo subir la foto");
  return j.key;
}

async function resolvePhotos(refs: PhotoRef[]) {
  const out: { key: string; stage: "inicio" | "fin" }[] = [];
  for (const r of refs) {
    const key = r.key ?? (r.localId ? await getPhotoKey(r.localId) : undefined);
    if (!key) throw new Error("pending-photo");
    out.push({ key, stage: r.stage });
  }
  return out;
}

/** Live actions use server time; replays older than a minute keep the original instant. */
const replayedAt = (item: { createdAt: number; payload: { at: string } }) => (Date.now() - item.createdAt > 60_000 ? new Date(item.payload.at) : null);

async function execute(item: OutboxItem): Promise<{ ok: true } | { ok: false; error: string }> {
  switch (item.kind) {
    case "clockIn": {
      const r = await clockIn({ shiftId: item.payload.shiftId, lat: item.payload.lat, lng: item.payload.lng, at: replayedAt(item) });
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }
    case "clockOut": {
      const r = await clockOut({ ...item.payload, at: replayedAt(item) });
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }
    case "photo": {
      const key = await uploadPhoto(item.payload);
      await setPhotoKey(item.payload.localId, key);
      return { ok: true };
    }
    case "report": {
      const photos = await resolvePhotos(item.payload.photos);
      const r = await submitJobReport({ ...item.payload, photos });
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }
  }
}

/** Runs now when possible; queues on network failure. Returns the server error for validation failures. */
export async function runOrQueue(item: Omit<OutboxItem, "id" | "createdAt">): Promise<{ status: "done" | "queued" } | { status: "error"; error: string }> {
  const full = { ...item, id: uid(), createdAt: Date.now() } as OutboxItem;
  if (!navigator.onLine) {
    await putItem(full);
    notifyChange();
    return { status: "queued" };
  }
  try {
    const r = await execute(full);
    return r.ok ? { status: "done" } : { status: "error", error: r.error };
  } catch (e) {
    if (isNetworkError(e) || (e instanceof Error && e.message === "pending-photo")) {
      await putItem(full);
      notifyChange();
      return { status: "queued" };
    }
    return { status: "error", error: e instanceof Error ? e.message : "Error" };
  }
}

let flushing = false;
/** Replays queued items in order: photos first so reports can reference their keys. */
export async function flushOutbox(): Promise<{ sent: number; failed: number }> {
  if (flushing || !navigator.onLine) return { sent: 0, failed: 0 };
  flushing = true;
  let sent = 0;
  let failed = 0;
  try {
    const all = (await listOutbox()).sort((a, b) => (a.kind === "photo" ? -1 : 0) - (b.kind === "photo" ? -1 : 0) || a.createdAt - b.createdAt);
    for (const item of all) {
      try {
        const r = await execute(item);
        if (r.ok) {
          await removeItem(item.id);
          sent++;
        } else {
          // validation error: keep it visible but do not retry forever
          await putItem({ ...item, error: r.error } as OutboxItem);
          failed++;
        }
      } catch (e) {
        if (isNetworkError(e)) break;
        if (e instanceof Error && e.message === "pending-photo") continue;
        await putItem({ ...item, error: e instanceof Error ? e.message : "Error" } as OutboxItem);
        failed++;
      }
    }
  } finally {
    flushing = false;
    notifyChange();
  }
  return { sent, failed };
}

export async function discardItem(id: string) {
  await removeItem(id);
  notifyChange();
}

/** Downscales a camera photo to ≤1600 px JPEG before upload or storage. */
export async function compressImage(file: File, max = 1600, quality = 0.82): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b ?? file), "image/jpeg", quality));
  } catch {
    return file;
  }
}

export async function currentPosition(): Promise<{ lat: number | null; lng: number | null }> {
  if (!("geolocation" in navigator)) return { lat: null, lng: null };
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6 }),
      () => resolve({ lat: null, lng: null }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    ),
  );
}

export { uid as newLocalId };
