"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Ajustes from "./Ajustes";
import Importar from "./Importar";
import { Chamado, Conferencia, Detalhe, Indenizacao } from "./Modais";
import { Grupo, Tabela, Tile, Vazio, type Acao } from "./Tabela";
import {
  brl, brlShort, dentroDe30, norm, parado, situacao, soma, todayISO,
} from "@/lib/domain";
import type { Canal, Config, Devolucao, Mappings } from "@/lib/types";

type Aba = "radar" | "esperadas" | "encerradas" | "importar" | "ajustes";
type Modal =
  | { t: "conferencia"; row: Devolucao }
  | { t: "indenizacao"; row: Devolucao }
  | { t: "chamado"; row: Devolucao }
  | { t: "detalhe"; row: Devolucao }
  | null;

export default function RadarApp({
  initialRows, initialCfg, initialMaps, erroInicial,
}: {
  initialRows: Devolucao[]; initialCfg: Config; initialMaps: Mappings; erroInicial: string | null;
}) {
  const [rows, setRows] = useState<Devolucao[]>(initialRows);
  const [cfg, setCfg] = useState<Config>(initialCfg);
  const [maps, setMaps] = useState<Mappings>(initialMaps);
  const [aba, setAba] = useState<Aba>("radar");
  const [modal, setModal] = useState<Modal>(null);
  const [erro, setErro] = useState<string | null>(erroInicial);
  const [sync, setSync] = useState<{ estado: "ok" | "carregando" | "erro"; msg: string }>({
    estado: "ok", msg: "atualizado agora",
  });
  const [scanMsg, setScanMsg] = useState<{ txt: string; ok: boolean } | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const recarregar = useCallback(async (silencioso = true) => {
    if (!silencioso) setSync({ estado: "carregando", msg: "atualizando…" });
    try {
      const res = await fetch("/api/devolucoes", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || "falha ao carregar");
      setRows(data.rows as Devolucao[]);
      setErro(null);
      setSync({ estado: "ok", msg: "atualizado " + new Date().toLocaleTimeString("pt-BR").slice(0, 5) });
    } catch (e) {
      setSync({ estado: "erro", msg: "sem conexão com o banco" });
      if (!silencioso) setErro((e as Error).message);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => recarregar(true), 30000);
    const onFocus = () => recarregar(true);
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(id); window.removeEventListener("focus", onFocus); };
  }, [recarregar]);

  const patch = useCallback(async (id: string, campos: Partial<Devolucao>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...campos } : r)));
    try {
      const res = await fetch(`/api/devolucoes/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(campos),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || "falha ao salvar");
      setRows((rs) => rs.map((r) => (r.id === id ? (data.row as Devolucao) : r)));
      setSync({ estado: "ok", msg: "salvo " + new Date().toLocaleTimeString("pt-BR").slice(0, 5) });
    } catch (e) {
      setErro("Não deu para salvar: " + (e as Error).message + " — recarregue a página.");
      recarregar(true);
    }
  }, [recarregar]);

  /* ---------- ações ---------- */
  const darBaixa = (row: Devolucao, p: { divergente: boolean; grade: string; motivoReal: string; obs: string }) => {
    patch(row.id, {
      estado: "recebida", recebidaEm: todayISO(), divergente: p.divergente,
      grade: p.grade, motivoReal: p.motivoReal, obs: p.obs,
    });
    setModal(null);
    setTimeout(() => scanRef.current?.focus(), 50);
  };
  const abrirChamado = (row: Devolucao, protocolo: string) => {
    patch(row.id, { estado: "chamado", chamadoEm: todayISO(), protocolo });
    setModal(null);
  };
  const registrarIndenizacao = (row: Devolucao, valor: string, protocolo: string) => {
    const v = parseFloat(String(valor).replace(/[^\d,.-]/g, "").replace(",", "."));
    patch(row.id, {
      estado: "indenizada", indenizadaEm: todayISO(),
      valorIndenizado: Number.isFinite(v) ? v : row.valor, protocolo,
    });
    setModal(null);
  };
  const marcarPerda = (row: Devolucao) => { patch(row.id, { estado: "perda", perdaEm: todayISO() }); setModal(null); };
  const marcarContestada = (row: Devolucao) => patch(row.id, { contestadaEm: todayISO() });
  const reabrir = (row: Devolucao) => {
    patch(row.id, {
      estado: "esperando", recebidaEm: null, chamadoEm: null,
      indenizadaEm: null, perdaEm: null, contestadaEm: null, divergente: false,
    });
    setModal(null);
  };

  /* ---------- bipagem ---------- */
  function bipar(valor: string) {
    const q = norm(valor);
    if (!q) return;
    let hit = rows.find((r) => norm(r.pedido) === q || norm(r.rastreio) === q);
    if (!hit && q.length >= 6)
      hit = rows.find((r) => norm(r.pedido).includes(q) || norm(r.rastreio).includes(q));
    if (!hit) {
      setScanMsg({ txt: "não está na lista de esperadas — confira o canal ou avise o André", ok: false });
      return;
    }
    if (hit.estado !== "esperando" && hit.estado !== "chamado")
      setScanMsg({ txt: `pedido ${hit.pedido} já estava como ${situacao(hit, cfg).lab}`, ok: false });
    else setScanMsg(null);
    setModal({ t: "conferencia", row: hit });
  }

  /* ---------- derivados ---------- */
  const abertas = useMemo(() => rows.filter((r) => r.estado === "esperando"), [rows]);
  const grupos = useMemo(() => {
    const g = { contestar: [] as Devolucao[], chegou: [] as Devolucao[], extravio: [] as Devolucao[], cobrar: [] as Devolucao[], risco: [] as Devolucao[] };
    for (const r of rows) {
      const s = situacao(r, cfg);
      if (!s.acao) continue;
      if (s.acao.tipo === "contestar") g.contestar.push(r);
      else if (s.acao.tipo === "bipar") g.chegou.push(r);
      else if (s.acao.tipo === "chamado") g.extravio.push(r);
      else if (s.acao.tipo === "cobrar") g.cobrar.push(r);
      else g.risco.push(r);
    }
    const byDias = (a: Devolucao, b: Devolucao) => parado(b) - parado(a);
    g.extravio.sort(byDias); g.risco.sort(byDias); g.chegou.sort(byDias);
    return g;
  }, [rows, cfg]);
  const totalAcoes = grupos.contestar.length + grupos.chegou.length + grupos.extravio.length + grupos.cobrar.length + grupos.risco.length;

  const onDetalhe = (r: Devolucao) => setModal({ t: "detalhe", row: r });

  /* ---------- pedaços de UI ---------- */
  const ScanBar = (
    <div className="scan">
      <label htmlFor="scaninp">Bipagem</label>
      <input
        id="scaninp" ref={scanRef} type="text" autoComplete="off"
        placeholder="bipe ou digite o nº do pedido / rastreio e tecle Enter"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            bipar((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).value = "";
          }
        }}
      />
      <button className="primary" onClick={() => {
        if (scanRef.current) { bipar(scanRef.current.value); scanRef.current.value = ""; }
      }}>Dar baixa</button>
      {scanMsg && <div className={"scanmsg " + (scanMsg.ok ? "ok" : "bad")}>{scanMsg.txt}</div>}
    </div>
  );

  const Tiles = (() => {
    const risco = abertas.filter((r) => situacao(r, cfg).k === "risco");
    const extr = abertas.filter((r) => situacao(r, cfg).k === "extravio");
    const cheg = abertas.filter((r) => situacao(r, cfg).k === "chegou");
    const cham = rows.filter((r) => r.estado === "chamado");
    const cont = rows.filter((r) => situacao(r, cfg).k === "contestar");
    const inde = rows.filter((r) => r.estado === "indenizada" && dentroDe30(r.indenizadaEm));
    const perd = rows.filter((r) => r.estado === "perda" && dentroDe30(r.perdaEm));
    return (
      <div className="tiles">
        <Tile lab="Esperando" big={String(abertas.length)} sm={brlShort(soma(abertas))} cls="acc" />
        <Tile lab="Contestar" big={String(cont.length)} sm={brlShort(soma(cont))} cls={cont.length ? "crit" : ""} />
        <Tile lab="Entregue, falta bipar" big={String(cheg.length)} sm={brlShort(soma(cheg))} cls={cheg.length ? "warn" : ""} />
        <Tile lab="Em risco" big={String(risco.length)} sm={brlShort(soma(risco))} cls={risco.length ? "warn" : ""} />
        <Tile lab="Provável extravio" big={String(extr.length)} sm={brlShort(soma(extr))} cls={extr.length ? "crit" : ""} />
        <Tile lab="Chamados abertos" big={String(cham.length)} sm={brlShort(soma(cham))} cls={cham.length ? "warn" : ""} />
        <Tile lab="Indenizado 30d" big={brlShort(inde.reduce((a, r) => a + (r.valorIndenizado ?? r.valor ?? 0), 0))} sm={inde.length + " caso(s)"} cls="good" />
        <Tile lab="Perda 30d" big={brlShort(soma(perd))} sm={perd.length + " caso(s)"} cls={perd.length ? "crit" : ""} />
      </div>
    );
  })();

  const acoesExtravio = (r: Devolucao): Acao[] => [
    { l: "Chamado aberto", primary: true, fn: () => setModal({ t: "chamado", row: r }) },
    { l: "Chegou", fn: () => setModal({ t: "conferencia", row: r }) },
  ];
  const acoesChegou = (r: Devolucao): Acao[] => [
    { l: "Chegou", primary: true, fn: () => setModal({ t: "conferencia", row: r }) },
    { l: "Chamado", fn: () => setModal({ t: "chamado", row: r }) },
  ];

  function ViewRadar() {
    if (!rows.length)
      return (
        <>
          {ScanBar}{Tiles}
          <Vazio titulo="Nenhuma devolução na lista ainda."
            texto="Vá em Importar e cole o relatório de devoluções de um dos painéis. A lista de esperadas é o que torna possível notar a caixa que não chegou." />
        </>
      );
    return (
      <>
        {ScanBar}{Tiles}
        <Grupo cls="crit" titulo="Contestar hoje" cfg={cfg} rows={grupos.contestar} onDetalhe={onDetalhe}
          porque="Peça conferida com divergência. A janela de contestação é a mais curta que existe."
          acoes={(r) => [{ l: "Marcar contestada", primary: true, fn: () => marcarContestada(r) }]} />
        <Grupo cls="warn" titulo="Entregue pelo canal — procurar e bipar" cfg={cfg} rows={grupos.chegou} onDetalhe={onDetalhe}
          porque="O painel do canal já marcou a devolução como entregue, mas ninguém bipou a caixa aqui. Procure primeiro: pode estar no galpão sem baixa. Se não achar, aí sim é chamado — e o próprio painel dizendo ‘entregue’ vira a sua prova."
          acoes={(r) => [
            { l: "Achei / conferir", primary: true, fn: () => setModal({ t: "conferencia", row: r }) },
            { l: "Não achei — chamado", fn: () => setModal({ t: "chamado", row: r }) },
          ]} />
        <Grupo cls="crit" titulo="Abrir chamado de extravio" cfg={cfg} rows={grupos.extravio} onDetalhe={onDetalhe}
          porque="Rastreio reverso parado além do limite do canal. Não espere a plataforma reconhecer — ela não reconhece sozinha."
          acoes={acoesExtravio} />
        <Grupo cls="warn" titulo="Cobrar indenização" cfg={cfg} rows={grupos.cobrar} onDetalhe={onDetalhe}
          porque="Chamado aberto há 15 dias ou mais sem crédito."
          acoes={(r) => [
            { l: "Indenizada", primary: true, fn: () => setModal({ t: "indenizacao", row: r }) },
            { l: "Perda", fn: () => marcarPerda(r) },
          ]} />
        <Grupo cls="acc" titulo="Conferir rastreio" cfg={cfg} rows={grupos.risco} onDetalhe={onDetalhe}
          porque="Passou do prazo normal de retorno do canal, mas ainda dentro da janela."
          acoes={acoesChegou} />
        {totalAcoes === 0 && (
          <Vazio cls="acc" titulo="Nada vencendo hoje."
            texto="Todas as devoluções abertas estão dentro do prazo normal de retorno. Volte amanhã — a fila é diária." />
        )}
      </>
    );
  }

  function ViewEsperadas() {
    const lista = [...abertas, ...rows.filter((r) => r.estado === "chamado")].sort((a, b) => parado(b) - parado(a));
    if (!lista.length)
      return (<>{ScanBar}<Vazio titulo="Nenhuma devolução aberta." texto="Importe o relatório de devoluções de cada canal para montar a lista." /></>);
    return (
      <>
        {ScanBar}
        <div className="grp">
          <header>
            <h2>Devoluções esperadas</h2>
            <span className="why">Aprovadas na plataforma e ainda não bipadas na chegada.</span>
            <span className="tot">{lista.length} · {brl(soma(lista))}</span>
          </header>
          <Tabela rows={lista} cfg={cfg} onDetalhe={onDetalhe} acoes={acoesChegou} />
        </div>
      </>
    );
  }

  function ViewEncerradas() {
    const lista = rows
      .filter((r) => ["recebida", "indenizada", "perda"].includes(r.estado))
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    if (!lista.length) return <Vazio titulo="Nada encerrado ainda." />;

    const cont: Record<string, number> = {};
    let tot = 0;
    lista.forEach((r) => { if (r.motivoReal) { cont[r.motivoReal] = (cont[r.motivoReal] || 0) + 1; tot++; } });
    const pareto = Object.keys(cont).map((k) => ({ k, n: cont[k] })).sort((a, b) => b.n - a.n).slice(0, 6);

    return (
      <>
        {tot >= 3 && (
          <div className="panel">
            <h2>Por que elas voltaram</h2>
            <p className="help">
              Motivo real registrado na conferência, não o motivo que o comprador marcou. Os dois
              primeiros da lista são onde está o dinheiro.
            </p>
            <div className="scroll">
              <table style={{ minWidth: 520 }}>
                <tbody>
                  {pareto.map((a) => {
                    const pct = Math.round((a.n / tot) * 100);
                    return (
                      <tr key={a.k}>
                        <td>{a.k}</td>
                        <td style={{ width: "55%" }}>
                          <div style={{ height: 9, background: "var(--accent)", borderRadius: "0 3px 3px 0", width: Math.max(pct, 3) + "%" }} />
                        </td>
                        <td className="num tnum">{a.n} ({pct}%)</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="grp">
          <header>
            <h2>Encerradas</h2>
            <span className="why">Recebidas, indenizadas e perdas assumidas.</span>
            <span className="tot">{lista.length} · {brl(soma(lista))}</span>
          </header>
          <Tabela rows={lista} cfg={cfg} onDetalhe={onDetalhe} />
        </div>
      </>
    );
  }

  const abas: { k: Aba; l: string; c: number | null }[] = [
    { k: "radar", l: "Radar", c: totalAcoes || null },
    { k: "esperadas", l: "Esperadas", c: abertas.length || null },
    { k: "encerradas", l: "Encerradas", c: null },
    { k: "importar", l: "Importar", c: null },
    { k: "ajustes", l: "Ajustes", c: null },
  ];

  return (
    <div className="shell">
      <header className="top">
        <div>
          <h1>Radar de Devoluções</h1>
          <p className="sub">RVX Club · Shopee · Mercado Livre · TikTok Shop</p>
        </div>
        <div className="syncbox">
          <span className={"dot " + (sync.estado === "ok" ? "on" : sync.estado === "erro" ? "off" : "")} />
          <span className="syncmsg">{sync.msg}</span>
          <button className="tiny" onClick={() => recarregar(false)}>Atualizar</button>
        </div>
      </header>

      <nav className="tabs">
        {abas.map((a) => (
          <button key={a.k} aria-current={aba === a.k ? "true" : undefined} onClick={() => setAba(a.k)}>
            {a.l}{a.c ? <span className="count">{a.c}</span> : null}
          </button>
        ))}
      </nav>

      {erro && (
        <div className="banner">
          <b>Erro:</b> {erro}
        </div>
      )}

      <main>
        {aba === "radar" && <ViewRadar />}
        {aba === "esperadas" && <ViewEsperadas />}
        {aba === "encerradas" && <ViewEncerradas />}
        {aba === "importar" && (
          <Importar rows={rows} maps={maps}
            onImportado={async (canal: Canal, nomes) => {
              setMaps((m) => ({ ...m, [canal]: nomes }));
              await fetch("/api/mappings", {
                method: "PUT", headers: { "content-type": "application/json" },
                body: JSON.stringify({ canal, nomes }),
              }).catch(() => {});
              await recarregar(true);
              setAba("radar");
            }} />
        )}
        {aba === "ajustes" && (
          <Ajustes cfg={cfg} onSalvar={async (c) => {
            const res = await fetch("/api/config", {
              method: "PUT", headers: { "content-type": "application/json" },
              body: JSON.stringify({ cfg: c }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.erro);
            setCfg(data.cfg as Config);
          }} />
        )}
      </main>

      <footer className="foot">
        {rows.length} devoluções na base · dados no Firestore, atualizados a cada 30 segundos
      </footer>

      {modal?.t === "conferencia" && (
        <Conferencia row={modal.row} onClose={() => setModal(null)} onSalvar={(p) => darBaixa(modal.row, p)} />
      )}
      {modal?.t === "indenizacao" && (
        <Indenizacao row={modal.row} onClose={() => setModal(null)}
          onSalvar={(v, p) => registrarIndenizacao(modal.row, v, p)} />
      )}
      {modal?.t === "chamado" && (
        <Chamado row={modal.row} onClose={() => setModal(null)} onSalvar={(p) => abrirChamado(modal.row, p)} />
      )}
      {modal?.t === "detalhe" && (
        <Detalhe row={modal.row} cfg={cfg} onClose={() => setModal(null)}
          onAcao={(t) => {
            if (t === "reabrir") reabrir(modal.row);
            else if (t === "perda") marcarPerda(modal.row);
            else setModal({ t: "indenizacao", row: modal.row });
          }} />
      )}
    </div>
  );
}
