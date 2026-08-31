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

/**
 * Candidatos por campo, do mais específico para o mais genérico. A busca é feita em
 * duas passadas: primeiro nome exato, depois "contém". Os primeiros nomes de cada
 * lista são os cabeçalhos reais dos relatórios da Shopee, do Mercado Livre e do
 * TikTok Shop — por isso vêm na frente.
 */
const GUESS: Record<string, string[]> = {
  pedido: [
    "id do pedido", "n. do pedido", "numero do pedido", "order id", "order sn",
    "codigo do pedido", "numero de venda", "venda", "pedido", "order",
  ],
  produto: [
    "nome do produto", "nome do anuncio", "product name", "titulo do anuncio",
    "produto", "anuncio", "descricao", "item", "product", "titulo",
  ],
  sku: [
    "sku da variacao", "numero de referencia sku", "n. de referencia sku", "codigo sku",
    "sku do vendedor", "seller sku", "sku principal", "nome da variacao", "variacao",
    "sku", "variation", "referencia",
  ],
  valor: [
    "quantia total de reembolsos", "preco da unidade", "subtotal do produto",
    "preco acordado", "valor total", "total do pedido", "receita", "valor do produto",
    "subtotal", "preco", "valor", "total", "price", "amount",
  ],
  motivo: [
    "cancelar motivo", "motivo do cancelamento", "motivo da devolucao", "motivo do reembolso",
    "reason", "tipo de solicitacao", "motivo", "razao",
  ],
  aprovadaEm: [
    "tempo de envio de devolucao", "data da solicitacao", "data da devolucao",
    "data de criacao do pedido", "data da finalizacao do cancelamento", "data de criacao",
    "solicitado em", "criado em", "data devolucao", "return date", "create time",
    "data de aprovacao", "data",
  ],
  rastreio: [
    "numero de rastreamento de devolucao", "codigo de rastreio reverso",
    "rastreio de devolucao", "numero de rastreamento", "codigo de rastreio",
    "tracking number", "rastreamento", "rastreio", "tracking", "awb", "etiqueta",
  ],
  ultimoEventoEm: [
    "tempo de entrega de devolucao concluida", "tempo decorrido de reemboslo",
    "ultima atualizacao", "data de atualizacao", "atualizado em", "update time",
    "ultimo evento",
  ],
  comprador: [
    "nome de usuario (comprador)", "nome do destinatario", "comprador", "cliente",
    "buyer", "username", "destinatario",
  ],
  statusPlataforma: [
    "status da devolucao / reembolso", "status de rastreamento de devolucao",
    "status da devolucao", "status do pedido", "return status", "situacao", "status", "estado",
  ],
};

export const slug = (s: string) =>
  String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

export function autoMap(headers: string[]): Record<string, number> {
  const m: Record<string, number> = {};
  const slugs = headers.map(slug);

  for (const f of CAMPOS) {
    const cands = GUESS[f.k] || [];

    // A ordem dos candidatos é a prioridade: percorremos os candidatos, não as colunas.
    // Sem isso, uma coluna genérica que aparece antes na planilha (por exemplo
    // "SKU principal") venceria a específica que queremos ("SKU da Variação").
    let achou = -1;
    for (const c of cands) {
      const i = slugs.indexOf(c);
      if (i > -1) { achou = i; break; }
    }
    if (achou === -1) {
      for (const c of cands) {
        const i = slugs.findIndex((h) => h.includes(c));
        if (i > -1) { achou = i; break; }
      }
    }
    if (achou > -1) m[f.k] = achou;
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

/**
 * Detecta arquivo binário (xlsx, xls, zip, pdf) lido por engano como texto.
 * Um relatório de verdade não tem bytes de controle nas primeiras linhas.
 */
export function pareceBinario(text: string): boolean {
  const amostra = text.slice(0, 4000);
  if (!amostra) return false;
  if (amostra.startsWith("PK")) return true;            // zip / xlsx / ods
  if (amostra.startsWith("%PDF")) return true;          // pdf
  // eslint-disable-next-line no-control-regex
  const controle = (amostra.match(/[\u0000-\u0008\u000E-\u001F]/g) || []).length;
  return controle / amostra.length > 0.01;
}

/** Um número de pedido de verdade não tem caracteres de controle nem é gigante. */
export function pedidoPlausivel(v: string): boolean {
  if (!v) return false;
  const s = v.trim();
  if (s.length < 3 || s.length > 60) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\uFFFD]/.test(s)) return false;
  return /[A-Za-z0-9]/.test(s);
}
