/**
 * Leitor de .xlsx tolerante, sem dependência externa.
 *
 * Existe porque nem todo painel gera um .xlsx bem formado. O relatório de devoluções
 * do TikTok Shop, por exemplo, declara TODAS as células dentro de `<row r="1">` — uma
 * linha por célula, todas numeradas 1. Bibliotecas que montam a planilha lendo linha a
 * linha desistem no meio ("Out-of-place <row/>"). Este leitor se guia pela referência
 * de cada célula (A1, B2, …), então a ordem em que as linhas aparecem no arquivo não
 * importa.
 *
 * É usado só como segunda tentativa: o caminho normal continua sendo a biblioteca, que
 * trata datas e estilos melhor.
 */

const SIG_EOCD = 0x06054b50;
const SIG_CD = 0x02014b50;

interface EntradaZip { offset: number; metodo: number; tamanho: number }

function lerCentral(buf: Uint8Array): Map<string, EntradaZip> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 66000; i--) {
    if (dv.getUint32(i, true) === SIG_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("não parece um arquivo .xlsx");

  const total = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const entradas = new Map<string, EntradaZip>();
  const dec = new TextDecoder();

  for (let i = 0; i < total; i++) {
    if (dv.getUint32(p, true) !== SIG_CD) break;
    const metodo = dv.getUint16(p + 10, true);
    const tamanho = dv.getUint32(p + 20, true);
    const nomeLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const comentLen = dv.getUint16(p + 32, true);
    const offset = dv.getUint32(p + 42, true);
    const nome = dec.decode(buf.subarray(p + 46, p + 46 + nomeLen));
    entradas.set(nome.replace(/^\/+/, ""), { offset, metodo, tamanho });
    p += 46 + nomeLen + extraLen + comentLen;
  }
  return entradas;
}

async function extrair(buf: Uint8Array, e: EntradaZip): Promise<string> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const nomeLen = dv.getUint16(e.offset + 26, true);
  const extraLen = dv.getUint16(e.offset + 28, true);
  const ini = e.offset + 30 + nomeLen + extraLen;
  const bruto = buf.subarray(ini, ini + e.tamanho);
  if (e.metodo === 0) return new TextDecoder().decode(bruto);
  if (e.metodo !== 8) throw new Error("compressão não suportada");
  // Cópia para um ArrayBuffer próprio: o subarray aponta para o buffer inteiro do zip.
  const copia = new Uint8Array(bruto).buffer as ArrayBuffer;
  const stream = new Blob([copia]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(stream).text();
}

const ENTIDADES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'",
};

function desescapar(s: string): string {
  return s
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTIDADES[m])
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
}

/** "BC12" → { col: 54, lin: 12 }, ambos com base 0 na coluna e 1 na linha. */
function refCelula(r: string): { col: number; lin: number } | null {
  const m = /^([A-Z]+)(\d+)$/.exec(r);
  if (!m) return null;
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col: col - 1, lin: parseInt(m[2], 10) };
}

function lerSharedStrings(xml: string): string[] {
  const out: string[] = [];
  for (const si of xml.match(/<si\b[\s\S]*?<\/si>/g) || []) {
    const partes = si.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || [];
    out.push(partes.map((t) => desescapar(t.replace(/<[^>]+>/g, ""))).join(""));
  }
  return out;
}

/** Índices de estilo que formatam data — para não devolver 45900 no lugar de 10/09/2026. */
function estilosDeData(xml: string): Set<number> {
  const datas = new Set<number>();
  const builtin = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
  const custom = new Set<number>();
  for (const m of xml.matchAll(/<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)) {
    if (/[ymdhs]/i.test(m[2].replace(/\[[^\]]*\]/g, "").replace(/"[^"]*"/g, ""))) {
      custom.add(parseInt(m[1], 10));
    }
  }
  const bloco = /<cellXfs\b[\s\S]*?<\/cellXfs>/.exec(xml)?.[0] || "";
  let i = 0;
  for (const m of bloco.matchAll(/<xf\b[^>]*>/g)) {
    const id = /numFmtId="(\d+)"/.exec(m[0]);
    const n = id ? parseInt(id[1], 10) : 0;
    if (builtin.has(n) || custom.has(n)) datas.add(i);
    i++;
  }
  return datas;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Número de série do Excel → dd/mm/aaaa (a data-base é 30/12/1899). */
function serialParaData(n: number): string {
  const ms = Math.round((n - 25569) * 86400000);
  const d = new Date(ms);
  if (isNaN(d.getTime())) return String(n);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

export async function lerXlsxTolerante(file: File): Promise<string[][]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const entradas = lerCentral(buf);

  const planilhas = [...entradas.keys()].filter((n) => /^xl\/worksheets\/.*\.xml$/i.test(n));
  if (!planilhas.length) throw new Error("a planilha não tem abas legíveis");

  const compartilhadas = entradas.has("xl/sharedStrings.xml")
    ? lerSharedStrings(await extrair(buf, entradas.get("xl/sharedStrings.xml")!))
    : [];
  const datas = entradas.has("xl/styles.xml")
    ? estilosDeData(await extrair(buf, entradas.get("xl/styles.xml")!))
    : new Set<number>();

  // A aba certa é a que tem mais células, não necessariamente a primeira do zip.
  let melhorXml = "";
  let melhorNota = -1;
  for (const nome of planilhas) {
    const xml = await extrair(buf, entradas.get(nome)!);
    const nota = (xml.match(/<c\b/g) || []).length;
    if (nota > melhorNota) { melhorNota = nota; melhorXml = xml; }
  }

  const grade: string[][] = [];
  for (const m of melhorXml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attrs = m[1] || "";
    const corpo = m[2] || "";
    const ref = /r="([A-Z]+\d+)"/.exec(attrs);
    if (!ref) continue;
    const pos = refCelula(ref[1]);
    if (!pos) continue;

    const tipo = /t="([^"]*)"/.exec(attrs)?.[1] || "";
    let valor = "";
    if (tipo === "inlineStr") {
      const partes = corpo.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || [];
      valor = partes.map((t) => desescapar(t.replace(/<[^>]+>/g, ""))).join("");
    } else {
      const v = /<v>([\s\S]*?)<\/v>/.exec(corpo)?.[1];
      if (v !== undefined) {
        valor = desescapar(v);
        if (tipo === "s") valor = compartilhadas[parseInt(valor, 10)] ?? "";
        else if (!tipo || tipo === "n") {
          const estilo = parseInt(/s="(\d+)"/.exec(attrs)?.[1] || "-1", 10);
          const num = Number(valor);
          if (datas.has(estilo) && isFinite(num) && num > 0) valor = serialParaData(num);
        }
      }
    }

    const linha = (grade[pos.lin - 1] ||= []);
    while (linha.length < pos.col) linha.push("");
    linha[pos.col] = valor.trim();
  }

  const largura = grade.reduce((a, l) => Math.max(a, l ? l.length : 0), 0);
  return grade.map((l) => {
    const c = l ? l.slice() : [];
    while (c.length < largura) c.push("");
    return c.map((v) => v ?? "");
  });
}
