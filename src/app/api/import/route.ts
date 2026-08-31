import { NextResponse } from "next/server";
import { COL, db } from "@/lib/firebase-admin";
import { docId, parseDate, parseMoney, todayISO } from "@/lib/domain";
import { pedidoPlausivel } from "@/lib/csv";
import { CANAIS, type Canal, type Devolucao } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

interface Entrada {
  pedido?: string; produto?: string; sku?: string; valor?: string;
  motivo?: string; aprovadaEm?: string; rastreio?: string;
  ultimoEventoEm?: string; comprador?: string; statusPlataforma?: string;
}

export async function POST(req: Request) {
  try {
    const { canal, linhas } = (await req.json()) as { canal: Canal; linhas: Entrada[] };
    if (!CANAIS.includes(canal)) return NextResponse.json({ erro: "canal_invalido" }, { status: 400 });
    if (!Array.isArray(linhas)) return NextResponse.json({ erro: "linhas_invalidas" }, { status: 400 });
    if (linhas.length > 3000) return NextResponse.json({ erro: "arquivo_muito_grande" }, { status: 400 });

    const agora = new Date().toISOString();
    const porId = new Map<string, Devolucao>();
    const candidatos: Devolucao[] = [];
    let semPedido = 0;

    for (const l of linhas) {
      const pedido = String(l.pedido || "").trim();
      // Barreira final: se o arquivo foi lido errado (um .xlsx tratado como texto, por
      // exemplo), o "pedido" vem com lixo binário. Nada disso entra no banco.
      if (!pedidoPlausivel(pedido)) { semPedido++; continue; }
      const id = docId(canal, pedido);
      // Uma linha por item no relatório: o mesmo pedido pode repetir. Vira um registro
      // só, com os valores dos itens somados.
      const jaVisto = porId.get(id);
      if (jaVisto) { jaVisto.valor = (jaVisto.valor || 0) + parseMoney(l.valor); continue; }
      const novo: Devolucao = {
        id, canal, pedido,
        produto: String(l.produto || "").trim(),
        sku: String(l.sku || "").trim(),
        valor: parseMoney(l.valor),
        motivo: String(l.motivo || "").trim(),
        aprovadaEm: parseDate(l.aprovadaEm) || todayISO(),
        rastreio: String(l.rastreio || "").trim(),
        ultimoEventoEm: parseDate(l.ultimoEventoEm),
        comprador: String(l.comprador || "").trim(),
        statusPlataforma: String(l.statusPlataforma || "").trim(),
        estado: "esperando",
        criadoEm: agora,
        updatedAt: agora,
      };
      porId.set(id, novo);
      candidatos.push(novo);
    }

    const firestore = db();
    const col = firestore.collection(COL);

    const existentes = new Set<string>();
    for (let i = 0; i < candidatos.length; i += 300) {
      const fatia = candidatos.slice(i, i + 300).map((c) => col.doc(c.id));
      if (!fatia.length) continue;
      const snaps = await firestore.getAll(...fatia);
      snaps.forEach((s) => { if (s.exists) existentes.add(s.id); });
    }

    const novas = candidatos.filter((c) => !existentes.has(c.id));

    for (let i = 0; i < novas.length; i += 400) {
      const batch = firestore.batch();
      novas.slice(i, i + 400).forEach((n) => batch.set(col.doc(n.id), n));
      await batch.commit();
    }

    const atualizaveis = candidatos.filter((c) => existentes.has(c.id) && (c.rastreio || c.ultimoEventoEm));
    for (let i = 0; i < atualizaveis.length; i += 400) {
      const batch = firestore.batch();
      for (const c of atualizaveis.slice(i, i + 400)) {
        const patch: Record<string, unknown> = {};
        if (c.rastreio) patch.rastreio = c.rastreio;
        if (c.ultimoEventoEm) patch.ultimoEventoEm = c.ultimoEventoEm;
        if (Object.keys(patch).length) batch.set(col.doc(c.id), patch, { merge: true });
      }
      await batch.commit();
    }

    return NextResponse.json({
      importadas: novas.length,
      duplicadas: candidatos.length - novas.length,
      semPedido,
      atualizadas: atualizaveis.length,
    });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
