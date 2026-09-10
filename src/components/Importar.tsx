"use client";
import React, { useMemo, useRef, useState } from "react";
import { autoMap, detectDelim, mapFromNames, pareceBinario, parseCSV, pedidoPlausivel } from "@/lib/csv";
import { brl, docId, parseDate, parseMoney, todayISO } from "@/lib/domain";
import { CAMPOS, CANAIS, type Canal, type Devolucao, type Mappings } from "@/lib/types";

interface Props {
  rows: Devolucao[];
  maps: Mappings;
  onImportado: (canal: Canal, nomes: Record<string, string>) => void;
}

export default function Importar({ rows, maps, onImportado }: Props) {
  const [canal, setCanal] = useState<Canal>("Shopee");
  const [raw, setRaw] = useState("");
  const [tabela, setTabela] = useState<string[][] | null>(null);
  const [map, setMap] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const headers = tabela?.[0] || [];

  function analisar(texto?: string) {
    const text = texto ?? raw;
    setMsg(null);
    if (!text.trim()) { setMsg("Cole o conteúdo do relatório primeiro."); setTabela(null); return; }
    if (pareceBinario(text)) {
      setMsg(
        "Esse conteúdo é de um arquivo do Excel (.xlsx), não dá para colar como texto. " +
        "Use o botão Arquivo aqui do lado e escolha o .xlsx — eu leio direto."
      );
      setTabela(null);
      return;
    }
    const linhas = parseCSV(text, detectDelim(text));
    if (linhas.length < 2) {
      setMsg("Não consegui separar as colunas. Confira se o arquivo tem cabeçalho e mais de uma linha.");
      setTabela(null);
      return;
    }
    setTabela(linhas);
    const salvo = maps[canal];
    setMap(salvo ? mapFromNames(salvo, linhas[0]) : autoMap(linhas[0]));
  }

  const previa = useMemo(() => {
    if (!tabela || map.pedido === undefined) return null;
    const existentes = new Set(rows.map((r) => r.id));
    const vistos = new Map<string, Partial<Devolucao>>();
    const novas: Partial<Devolucao>[] = [];
    let dup = 0, semPedido = 0;

    for (const cols of tabela.slice(1)) {
      const g = (k: string) => {
        const i = map[k];
        return i === undefined ? "" : String(cols[i] ?? "").trim();
      };
      const pedido = g("pedido");
      if (!pedidoPlausivel(pedido)) { semPedido++; continue; }
      const id = docId(canal, pedido);
      if (existentes.has(id)) { dup++; continue; }
      // Os relatórios trazem uma linha por item: o mesmo pedido pode repetir. Juntamos
      // num registro só (é um pacote só que volta) somando o valor dos itens.
      const jaVista = vistos.get(id);
      if (jaVista) { jaVista.valor = (jaVista.valor || 0) + parseMoney(g("valor")); dup++; continue; }
      const nova: Partial<Devolucao> = {
        pedido, produto: g("produto"), sku: g("sku"),
        valor: parseMoney(g("valor")), motivo: g("motivo"),
        aprovadaEm: parseDate(g("aprovadaEm")) || todayISO(),
        rastreio: g("rastreio"), ultimoEventoEm: parseDate(g("ultimoEventoEm")),
        entregueEm: parseDate(g("entregueEm")),
        comprador: g("comprador"), statusPlataforma: g("statusPlataforma"),
      };
      vistos.set(id, nova);
      novas.push(nova);
    }

    // Aviso: relatório de pedidos CANCELADOS não é relatório de devolução. Cancelamento
    // acontece antes do envio — não existe pacote voltando para conferir.
    // O relatório de "falha na entrega" também vem com status Cancelado, mas ele É uma
    // devolução (o pacote está voltando). Por isso o nome do arquivo manda: só avisamos
    // quando ele identifica o relatório de cancelamentos.
    const nome = nomeArquivo.toLowerCase();
    const arquivoDeDevolucao = /return|refund|devolu|failed_delivery|falha/.test(nome);
    const arquivoDeCancelamento = /cancel/.test(nome) && !arquivoDeDevolucao;
    const cancelados = novas.filter((r) =>
      /cancelad/i.test(String(r.statusPlataforma || "") + " " + String(r.motivo || ""))
    ).length;
    const pareceCancelamento =
      arquivoDeCancelamento ||
      (!arquivoDeDevolucao && novas.length >= 5 && cancelados / novas.length > 0.6);

    return { novas, dup, semPedido, pareceCancelamento };
  }, [tabela, map, rows, canal, nomeArquivo]);

  async function importar() {
    if (!tabela || map.pedido === undefined) return;
    setEnviando(true); setMsg(null);
    try {
      const linhas = tabela.slice(1).map((cols) => {
        const o: Record<string, string> = {};
        for (const f of CAMPOS) {
          const i = map[f.k];
          o[f.k] = i === undefined ? "" : String(cols[i] ?? "").trim();
        }
        return o;
      }).filter((o) => pedidoPlausivel(o.pedido));

      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ canal, linhas }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || "falha na importação");

      const nomes: Record<string, string> = {};
      for (const k of Object.keys(map)) nomes[k] = headers[map[k]];
      onImportado(canal, nomes);

      setRaw(""); setTabela(null); setMap({});
      if (fileRef.current) fileRef.current.value = "";
      setMsg(`${data.importadas} devolução(ões) importada(s). ${data.duplicadas} já estavam na lista.`);
    } catch (e) {
      setMsg("Erro: " + (e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <div className="panel">
        <h2>Importar devoluções do painel</h2>
        <p className="help">
          Exporte o relatório de devoluções do canal e cole o conteúdo abaixo (ou escolha o arquivo).
          Aceita a planilha .xlsx do painel direto, ou CSV com vírgula, ponto e vírgula ou tabulação. O mapeamento das colunas fica salvo
          por canal — você só faz isso uma vez.
        </p>

        <div className="row">
          <div className="fld">
            <label>Canal</label>
            <select value={canal} onChange={(e) => { setCanal(e.target.value as Canal); setTabela(null); }}>
              {CANAIS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="fld">
            <label>Arquivo</label>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xlsx" onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setMsg(null);
              setNomeArquivo(f.name);
              // A Shopee entrega o relatório de devoluções com extensão .xls mas o
              // conteúdo é .xlsx. Por isso decidimos pelo conteúdo (assinatura "PK"),
              // nunca pelo nome do arquivo.
              f.slice(0, 4).arrayBuffer().then((buf) => {
                const b = new Uint8Array(buf);
                const ehZip = b[0] === 0x50 && b[1] === 0x4b; // "PK"
                if (ehZip) {
                setMsg("Lendo a planilha…");
                import("read-excel-file/browser")
                  .then((m) => m.default(f))
                  .then((linhas) => {
                    // A biblioteca devolve as planilhas do arquivo; usamos a primeira
                    // que tenha conteúdo.
                    type Planilha = { sheet?: string; data?: unknown[][] };
                    const bruto = linhas as unknown as Planilha[] | unknown[][];
                    const primeira = Array.isArray(bruto[0]) ? (bruto as unknown[][]) : null;
                    const celulas: unknown[][] =
                      primeira ??
                      ((bruto as Planilha[]).find((p) => (p?.data?.length || 0) > 1)?.data ??
                        (bruto as Planilha[])[0]?.data ??
                        []);
                    const grade = celulas.map((l) =>
                      (Array.isArray(l) ? l : []).map((c) =>
                        c === null || c === undefined ? "" : String(c).trim()
                      )
                    );
                    const uteis = grade.filter((l) => l.some((c) => c !== ""));
                    if (uteis.length < 2) {
                      setMsg("A planilha não tem linhas de dados abaixo do cabeçalho.");
                      setTabela(null);
                      return;
                    }
                    setRaw("");
                    setTabela(uteis);
                    const salvo = maps[canal];
                    setMap(salvo ? mapFromNames(salvo, uteis[0]) : autoMap(uteis[0]));
                    setMsg(null);
                  })
                  .catch(() =>
                    setMsg(
                      "Não consegui abrir essa planilha. Se ela veio dentro de um .zip, " +
                      "descompacte primeiro e escolha a planilha de dentro."
                    )
                  );
                  return;
                }
                const fr = new FileReader();
                fr.onload = () => { const t = String(fr.result || ""); setRaw(t); analisar(t); };
                fr.readAsText(f, "utf-8");
              });
            }} />
          </div>
        </div>

        <textarea placeholder="Cole aqui o conteúdo do CSV, com a linha de cabeçalho. Para .xlsx, use o botão Arquivo acima."
          value={raw} onChange={(e) => setRaw(e.target.value)} />

        <div className="row" style={{ marginTop: ".8rem" }}>
          <button className="primary" onClick={() => analisar()}>Analisar colunas</button>
          <button onClick={() => { setRaw(""); setTabela(null); setMsg(null); setNomeArquivo(""); if (fileRef.current) fileRef.current.value = ""; }}>
            Limpar
          </button>
        </div>

        {msg && <div className="warnbox"><p>{msg}</p></div>}

        {tabela && (
          <>
            <h2 style={{ fontSize: ".95rem", margin: "1.4rem 0 .2rem" }}>Ligue as colunas</h2>
            <p className="help">
              Detectei {headers.length} colunas e {tabela.length - 1} linhas. Confira o que ficou
              automático — só pedido e data são obrigatórios.
            </p>
            <div className="mapgrid">
              {CAMPOS.map((f) => (
                <div className="fld" key={f.k}>
                  <label>{f.l}{f.req && <span className="req"> *</span>}</label>
                  <select
                    value={map[f.k] === undefined ? "" : String(map[f.k])}
                    onChange={(e) => {
                      const v = e.target.value;
                      setMap((m) => {
                        const n = { ...m };
                        if (v === "") delete n[f.k]; else n[f.k] = parseInt(v, 10);
                        return n;
                      });
                    }}
                  >
                    <option value="">— não tenho —</option>
                    {headers.map((h, i) => <option key={i} value={String(i)}>{h || "coluna " + (i + 1)}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {map.pedido === undefined ? (
              <div className="warnbox">
                <p>Escolha qual coluna tem o número do pedido — sem ela não dá para cruzar com a bipagem.</p>
              </div>
            ) : previa && (
              <>
                {previa.pareceCancelamento && (
                  <div className="warnbox">
                    <p>
                      <strong>Atenção: isso parece um relatório de pedidos cancelados.</strong>{" "}
                      Cancelamento acontece antes do envio — não existe pacote voltando, então
                      essas linhas nunca vão ser bipadas e vão ficar presas em &ldquo;esperando&rdquo;
                      para sempre. O relatório certo é o de <strong>devoluções e reembolsos</strong>
                      {" "}(e, para pacotes que voltaram sozinhos, o de <strong>falha na
                      entrega</strong>). Se quiser importar assim mesmo, pode seguir.
                    </p>
                  </div>
                )}
                <div className="preview">
                  Novas devoluções a importar: <b>{previa.novas.length}</b><br />
                  Já estavam na lista (ignoradas): {previa.dup}<br />
                  {previa.semPedido > 0 && <><span className="bad">Linhas descartadas (sem número de pedido válido): {previa.semPedido}</span><br /></>}
                  Valor total das novas: <b>{brl(previa.novas.reduce((a, r) => a + (r.valor || 0), 0))}</b>
                </div>
                {previa.novas[0] && (
                  <div className="preview">
                    <span style={{ color: "var(--muted)" }}>amostra da 1ª linha</span><br />
                    pedido: {previa.novas[0].pedido}<br />
                    produto: {previa.novas[0].produto || "—"}<br />
                    valor: {brl(previa.novas[0].valor)}<br />
                    data: {previa.novas[0].aprovadaEm}<br />
                    rastreio: {previa.novas[0].rastreio || "—"}
                  </div>
                )}
                <div className="row" style={{ marginTop: ".9rem" }}>
                  <button className="primary" onClick={importar} disabled={enviando || !previa.novas.length}>
                    {enviando ? "Importando…" : `Importar ${previa.novas.length} devoluções`}
                  </button>
                  <span className="syncmsg">o mapeamento fica salvo para {canal}</span>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="panel">
        <h2>Onde achar o relatório em cada canal</h2>
        <p className="help">
          Os nomes das telas mudam de tempos em tempos. O que você procura é sempre a lista de
          devoluções/reembolsos com data e código de rastreio reverso — é ela que vira a lista de esperadas.
        </p>
        <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: ".86rem", color: "var(--muted)", lineHeight: 1.8 }}>
          <li>Shopee Seller Centre → Pedidos → Devoluções/Reembolsos → exportar</li>
          <li>Mercado Livre → Vendas → Devoluções → baixar planilha</li>
          <li>TikTok Shop Seller Center → Pedidos → Devoluções e reembolsos → exportar</li>
        </ul>
      </div>
    </div>
  );
}
