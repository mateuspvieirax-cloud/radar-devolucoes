import { CAMPOS } from "./types";

export function detectDelim(text: string): string {
  const line = text.split(/\r?\n/)[0] || "";
  const c = (line.match(/,/g) || []).length;
  const sc = (line.match(/;/g) || []).length;
  const t = (line.match(/\t/g) || []).length;
  if (t >= c && t >= sc && t > 0) return "\t";
  return sc > c ? ";" : ",";
}

export function parseCSV(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  let i = 0;
  text = text.replace(/^\uFEFF/, "");
  while (i < text.length) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += ch;
    } else {
      if (ch === '"') q = true;
      else if (ch === delim) { row.push(cur); cur = ""; }
      else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (ch === "\r") { /* skip */ }
      else cur += ch;
    }
    i++;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

const GUESS: Record<string, string[]> = {
  pedido: ["pedido", "order", "n. do pedido", "numero do pedido", "id do pedido", "order id", "order sn", "codigo do pedido", "venda"],
  produto: ["produto", "item", "nome do produto", "product", "descricao", "anuncio", "titulo"],
  sku: ["sku", "variacao", "variation", "modelo", "referencia", "cor/tamanho"],
  valor: ["valor", "total", "preco", "price", "amount", "valor do produto", "subtotal", "receita"],
  motivo: ["motivo", "reason", "razao", "motivo da devolucao", "tipo de solicitacao"],
  aprovadaEm: ["data", "data da solicitacao", "data de criacao", "criado em", "solicitado em", "data devolucao", "return date", "create time", "data de aprovacao"],
  rastreio: ["rastreio", "rastreamento", "tracking", "codigo de rastreio", "awb", "etiqueta", "tracking number"],
  ultimoEventoEm: ["ultima atualizacao", "atualizado em", "update time", "ultimo evento", "data de atualizacao"],
  comprador: ["comprador", "cliente", "buyer", "username", "destinatario"],
  statusPlataforma: ["status", "situacao", "estado", "status da devolucao", "return status"],
};

export const slug = (s: string) =>
  String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

export function autoMap(headers: string[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const f of CAMPOS) {
    const cands = GUESS[f.k] || [];
    let exact = -1;
    for (let i = 0; i < headers.length; i++) {
      if (cands.includes(slug(headers[i]))) { exact = i; break; }
    }
    if (exact > -1) { m[f.k] = exact; continue; }
    for (let i = 0; i < headers.length; i++) {
      const h = slug(headers[i]);
      if (cands.some((c) => h.includes(c))) { if (m[f.k] === undefined) m[f.k] = i; }
    }
  }
  return m;
}

export function mapFromNames(names: Record<string, string>, headers: string[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const k of Object.keys(names)) {
    const idx = headers.indexOf(names[k]);
    if (idx > -1) m[k] = idx;
  }
  const g = autoMap(headers);
  for (const k of Object.keys(g)) if (m[k] === undefined) m[k] = g[k];
  return m;
}

export function csvEscape(v: unknown): string {
  const s = String(v === null || v === undefined ? "" : v);
  return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
