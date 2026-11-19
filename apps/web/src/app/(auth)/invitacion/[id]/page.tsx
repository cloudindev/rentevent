import type { Metadata } from "next";
import Link from "next/link";
import { AuthSplit } from "@/components/auth-split";
import { ROLE_LABELS } from "@/lib/permissions";
import type { Role } from "@rentevent/db/schema";
import { invitationInfo } from "@/server/actions/auth";
import { getAuthSession } from "@/server/context";
import { InvitationActions } from "./actions";

export const metadata: Metadata = { title: "Invitación", robots: { index: false } };

export default async function InvitationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await invitationInfo(id);
  const session = await getAuthSession();
  const valid = inv && inv.status === "pending" && inv.expiresAt > new Date();
  return (
    <AuthSplit>
      {!valid ? (
        <>
          <h1 className="text-2xl font-semibold">Invitación no válida</h1>
          <p className="mt-2 text-sm text-muted-foreground">Puede que haya caducado o que ya se haya usado. Pide al administrador que te envíe otra.</p>
          <Link href="/acceso" className="mt-6 inline-block text-sm text-link hover:underline">
            Ir al acceso
          </Link>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Te han invitado a</p>
          <h1 className="mt-1 text-2xl font-semibold">{inv.orgName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Rol: <strong className="text-foreground">{ROLE_LABELS[(inv.role ?? "solo_lectura") as Role]}</strong> · para {inv.email}
          </p>
          <div className="mt-6">
            <InvitationActions id={inv.id} email={inv.email} signedInAs={session?.user.email ?? null} />
          </div>
        </>
      )}
    </AuthSplit>
  );
}
