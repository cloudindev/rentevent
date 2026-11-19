import "server-only";
import { env } from "../env";

export type GeoResult = { lat: number; lng: number; label: string; precision: "exacta" | "municipio" | "aproximada"; mode: "real" | "simulado" };

/** Offline gazetteer used in simulated mode (Asturias and main Spanish cities). */
const PLACES: Record<string, [number, number]> = {
  oviedo: [43.3614, -5.8494], gijon: [43.5322, -5.6611], aviles: [43.5547, -5.9248], llanes: [43.4198, -4.7549],
  "cangas de onis": [43.3507, -5.1286], ribadesella: [43.4623, -5.0592], villaviciosa: [43.4813, -5.4357], siero: [43.392, -5.6627],
  "pola de siero": [43.392, -5.6627], mieres: [43.2502, -5.7767], langreo: [43.296, -5.6828], "la felguera": [43.3074, -5.6888],
  cudillero: [43.5626, -6.1452], luarca: [43.5426, -6.5361], navia: [43.5396, -6.7187], tineo: [43.3375, -6.4147], cangas: [43.1772, -6.5486],
  llanera: [43.4366, -5.8563], lugones: [43.4029, -5.8113], noreña: [43.3955, -5.7106], grado: [43.3868, -6.0721], salinas: [43.5764, -5.9581],
  colunga: [43.4864, -5.2711], lastres: [43.5131, -5.2665], candas: [43.5888, -5.7635], "pola de lena": [43.1585, -5.8282], posada: [43.4366, -5.8563],
  santander: [43.4623, -3.81], leon: [42.5987, -5.5671], madrid: [40.4168, -3.7038], bilbao: [43.263, -2.935], "a coruña": [43.3623, -8.4115],
  lugo: [43.0097, -7.556], valladolid: [41.6523, -4.7245], burgos: [42.3439, -3.6969], ponferrada: [42.5465, -6.5962], barcelona: [41.3874, 2.1686],
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function simulated(address: string): GeoResult {
  const n = norm(address);
  const hit = Object.keys(PLACES)
    .sort((a, b) => b.length - a.length)
    .find((k) => n.includes(norm(k)));
  // deterministic jitter so different streets in a town don't collapse to one point
  let h = 0;
  for (const c of n) h = (h * 31 + c.charCodeAt(0)) | 0;
  const jx = ((h & 0xff) / 255 - 0.5) * 0.02;
  const jy = (((h >> 8) & 0xff) / 255 - 0.5) * 0.02;
  if (hit) {
    const [lat, lng] = PLACES[hit]!;
    return { lat: lat + jy, lng: lng + jx, label: address, precision: "municipio", mode: "simulado" };
  }
  return { lat: 43.3614 + jy * 10, lng: -5.8494 + jx * 10, label: address, precision: "aproximada", mode: "simulado" };
}

export async function geocode(address: string): Promise<GeoResult | null> {
  if (!address.trim()) return null;
  if (env.geocoder) {
    try {
      const url = `${env.geocoder}?format=json&limit=1&countrycodes=es,pt&q=${encodeURIComponent(address)}`;
      const res = await fetch(url, { headers: { "User-Agent": "rentevent-geocoder" }, signal: AbortSignal.timeout(5000) });
      const data = (await res.json()) as { lat: string; lon: string; display_name: string }[];
      if (data[0]) return { lat: Number(data[0].lat), lng: Number(data[0].lon), label: data[0].display_name, precision: "exacta", mode: "real" };
    } catch {
      /* fall back to the offline gazetteer */
    }
  }
  return simulated(address);
}

export const navigationUrl = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
