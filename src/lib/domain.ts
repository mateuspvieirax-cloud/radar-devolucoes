import { Config, DEFAULT_CONFIG, Devolucao, PrazoCanal } from "./types";

export const pad = (n: number | string) => String(n).padStart(2, "0");

export function todayISO(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDate(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  if (m) {
    let y = m[3];
    if (y.length === 2) y = "20" + y;
    return `${y}-${pad(m[2])}-${pad(m[1])}`;
  }
  return null;
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const p = iso.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}` : iso;
}

export function daysBetween(a?: string | null, b?: string | null): number | null {
  if (!a) return null;
  const d1 = new Date(a + "T00:00:00").getTime();
  const d2 = new Date((b || todayISO()) + "T00:00:00").getTime();
  if (isNaN(d1) || isNaN(d2)) return null;
  return Math.round((d2 - d1) / 86400000);
}

export function parseMoney(v: unknown): number {
  if (v === null || v === undefined) return 0;
  let s = String(v).replace(/[^\d,.\-]/g, "");
  if (!s) return 0;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export const brl = (n?: number) =>
  "R$ " + (n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function brlShort(n?: number) {
  const v = n || 0;
  if (Math.abs(v) >= 1000)
    return "R$ " + (v / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "k";
  return "R$ " + v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

export const norm = (s?: string) => String(s || "").replace(/[\s\-./#]/g, "").toUpperCase();

export const docId = (canal: string, pedido: string) =>
  `${norm(canal)}__${norm(pedido)}`.slice(0, 400);

export function cfgFor(cfg: Config, canal: string): PrazoCanal {
  return cfg?.[canal] || DEFAULT_CONFIG[canal] || { alerta: 7, extravio: 12, contestar: 2 };
}

export function parado(r: Devolucao, hoje?: string): number {
  const base = r.ultimoEventoEm || r.aprovadaEm;
  const d = daysBetween(base, hoje);
  return d === null ? 0 : d;
}

export type AcaoTipo = "contestar" | "chamado" | "cobrar" | "rastreio";
export interface Situacao {
  k: "esperando" | "risco" | "extravio" | "contestar" | "recebida" | "chamado" | "indenizada" | "perda";
  lab: string;
  cls: string;
  acao: { tipo: AcaoTipo; prio: number } | null;
  dias?: number;
}

export function situacao(r: Devolucao, cfg: Config, hoje?: string): Situacao {
  const c = cfgFor(cfg, r.canal);
  const d = parado(r, hoje);

  if (r.estado === "perda")
    return { k: "perda", lab: "perda assumida", cls: "perda", acao: null };
  if (r.estado === "indenizada")
    return { k: "indenizada", lab: "indenizada", cls: "indenizada", acao: null };

  if (r.estado === "chamado") {
    const dc = daysBetween(r.chamadoEm, hoje) ?? 0;
    return {
      k: "chamado", lab: "chamado aberto", cls: "chamado", dias: dc,
      acao: dc >= 15 ? { tipo: "cobrar", prio: 3 } : null,
    };
  }

  if (r.estado === "recebida") {
    if (r.divergente && !r.contestadaEm)
      return { k: "contestar", lab: "contestar", cls: "divergente", acao: { tipo: "contestar", prio: 1 } };
    return { k: "recebida", lab: r.divergente ? "contestada" : "conferida", cls: "recebida", acao: null };
  }

  if (d >= c.extravio)
    return { k: "extravio", lab: "provável extravio", cls: "extravio", acao: { tipo: "chamado", prio: 2 }, dias: d };
  if (d >= c.alerta)
    return { k: "risco", lab: "em risco", cls: "risco", acao: { tipo: "rastreio", prio: 4 }, dias: d };
  return { k: "esperando", lab: "esperando", cls: "esperando", acao: null, dias: d };
}

export const soma = (list: Devolucao[]) => list.reduce((a, r) => a + (r.valor || 0), 0);

export function dentroDe30(iso?: string | null, hoje?: string) {
  const d = daysBetween(iso, hoje);
  return d !== null && d <= 30 && d >= 0;
}
