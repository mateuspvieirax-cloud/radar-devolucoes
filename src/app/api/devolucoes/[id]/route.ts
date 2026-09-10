import { NextResponse } from "next/server";
import { bumpRev, COL, db } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PERMITIDO = new Set([
  "estado", "recebidaEm", "divergente", "grade", "motivoReal", "obs",
  "contestadaEm", "chamadoEm", "protocolo", "indenizadaEm", "valorIndenizado",
  "perdaEm", "rastreio", "ultimoEventoEm", "valor", "atualizadoPor",
]);

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;

    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) if (PERMITIDO.has(k)) patch[k] = v;
    if (!Object.keys(patch).length)
      return NextResponse.json({ erro: "nada_para_atualizar" }, { status: 400 });

    patch.updatedAt = new Date().toISOString();

    const ref = db().collection(COL).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ erro: "nao_encontrado" }, { status: 404 });

    await ref.set(patch, { merge: true });
    const novo = await ref.get();
    const rev = await bumpRev();
    return NextResponse.json({ row: { id: novo.id, ...novo.data() }, rev });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
