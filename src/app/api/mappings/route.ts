import { NextResponse } from "next/server";
import { APP_DOC } from "@/lib/firebase-admin";
import type { Mappings } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const snap = await APP_DOC("mappings").get();
    return NextResponse.json({ maps: (snap.data()?.maps as Mappings) || {} });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { canal, nomes } = (await req.json()) as { canal: string; nomes: Record<string, string> };
    if (!canal) return NextResponse.json({ erro: "canal_obrigatorio" }, { status: 400 });
    await APP_DOC("mappings").set(
      { maps: { [canal]: nomes }, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
