import { NextResponse } from "next/server";
import { COL, db, lerRev } from "@/lib/firebase-admin";
import type { Devolucao } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const snap = await db().collection(COL).limit(5000).get();
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Devolucao[];
    // Devolve o carimbo junto: assim a tela ja fica sincronizada sem uma consulta extra.
    return NextResponse.json({ rows, rev: await lerRev() });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
