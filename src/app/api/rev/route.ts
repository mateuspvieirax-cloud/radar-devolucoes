import { NextResponse } from "next/server";
import { lerRev } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Devolve só o carimbo da última alteração. É 1 leitura no Firestore, contra uma
 * leitura por devolução se buscássemos a lista inteira. É o que a tela consulta de
 * tempos em tempos; a lista completa só é buscada quando esse número muda.
 */
export async function GET() {
  try {
    return NextResponse.json({ rev: await lerRev() });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
