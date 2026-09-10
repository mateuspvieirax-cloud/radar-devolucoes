import { NextResponse } from "next/server";
import { APP_DOC, bumpRev } from "@/lib/firebase-admin";
import { DEFAULT_CONFIG, type Config } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const snap = await APP_DOC("config").get();
    const cfg = { ...DEFAULT_CONFIG, ...((snap.data()?.canais as Config) || {}) };
    return NextResponse.json({ cfg });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { cfg } = (await req.json()) as { cfg: Config };
    const limpo: Config = {};
    for (const canal of Object.keys(DEFAULT_CONFIG)) {
      const c = cfg?.[canal] || DEFAULT_CONFIG[canal];
      const n = (v: unknown, def: number) => {
        const x = Number(v);
        return Number.isFinite(x) && x >= 1 && x <= 90 ? Math.round(x) : def;
      };
      limpo[canal] = {
        alerta: n(c.alerta, DEFAULT_CONFIG[canal].alerta),
        extravio: n(c.extravio, DEFAULT_CONFIG[canal].extravio),
        contestar: n(c.contestar, DEFAULT_CONFIG[canal].contestar),
      };
    }
    await APP_DOC("config").set({ canais: limpo, updatedAt: new Date().toISOString() }, { merge: true });
    await bumpRev();
    return NextResponse.json({ cfg: limpo });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
