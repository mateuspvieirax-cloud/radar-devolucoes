import { COL, db } from "@/lib/firebase-admin";
import { APP_DOC } from "@/lib/firebase-admin";
import { csvEscape } from "@/lib/csv";
import { parado, situacao, todayISO } from "@/lib/domain";
import { DEFAULT_CONFIG, type Config, type Devolucao } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COLS = ["canal","pedido","produto","sku","valor","motivo","aprovadaEm","rastreio",
  "estado","situacao","diasParado","recebidaEm","divergente","grade","motivoReal",
  "contestadaEm","chamadoEm","protocolo","indenizadaEm","valorIndenizado","perdaEm","obs"];

export async function GET() {
  const snap = await db().collection(COL).limit(5000).get();
  const cfgSnap = await APP_DOC("config").get();
  const cfg: Config = { ...DEFAULT_CONFIG, ...((cfgSnap.data()?.canais as Config) || {}) };
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Devolucao[];

  const linhas = [COLS.join(";")];
  for (const r of rows) {
    const s = situacao(r, cfg);
    const o: Record<string, unknown> = {
      canal: r.canal, pedido: r.pedido, produto: r.produto, sku: r.sku,
      valor: String(r.valor || 0).replace(".", ","),
      motivo: r.motivo, aprovadaEm: r.aprovadaEm, rastreio: r.rastreio,
      estado: r.estado, situacao: s.lab,
      diasParado: r.estado === "esperando" ? parado(r) : "",
      recebidaEm: r.recebidaEm || "", divergente: r.divergente ? "sim" : "",
      grade: r.grade || "", motivoReal: r.motivoReal || "",
      contestadaEm: r.contestadaEm || "", chamadoEm: r.chamadoEm || "",
      protocolo: r.protocolo || "", indenizadaEm: r.indenizadaEm || "",
      valorIndenizado: r.valorIndenizado ? String(r.valorIndenizado).replace(".", ",") : "",
      perdaEm: r.perdaEm || "", obs: r.obs || "",
    };
    linhas.push(COLS.map((c) => csvEscape(o[c])).join(";"));
  }

  return new Response("﻿" + linhas.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="devolucoes-${todayISO()}.csv"`,
    },
  });
}
