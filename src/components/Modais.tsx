"use client";
import React, { useEffect, useState } from "react";
import { brl, fmtDate, situacao } from "@/lib/domain";
import { GRADES, MOTIVOS_REAIS, type Config, type Devolucao } from "@/lib/types";

function Mask({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="mask" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">{children}</div>
    </div>
  );
}

export function Conferencia({
  row, onClose, onSalvar,
}: {
  row: Devolucao;
  onClose: () => void;
  onSalvar: (p: { divergente: boolean; grade: string; motivoReal: string; obs: string }) => void;
}) {
  const [divergente, setDivergente] = useState(false);
  const [grade, setGrade] = useState("A");
  const [motivoReal, setMotivoReal] = useState("");
  const [obs, setObs] = useState("");
  const hint = GRADES.find((g) => g.g === grade)?.d || "";

  return (
    <Mask onClose={onClose}>
      <h2>Conferência na chegada</h2>
      <p className="who">
        {row.canal} · pedido {row.pedido} · {row.produto || "sem descrição"} · {brl(row.valor)}
      </p>

      <div className="fld" style={{ marginBottom: ".9rem" }}>
        <label>A peça bate com o que saiu?</label>
        <div className="seg">
          {[["Conferida OK", false], ["Divergente", true]].map(([l, v], i) => (
            <button key={i} aria-pressed={divergente === v} onClick={() => setDivergente(v as boolean)}>
              {l as string}
            </button>
          ))}
        </div>
      </div>

      <div className="fld" style={{ marginBottom: ".9rem" }}>
        <label>Destino da peça</label>
        <div className="seg">
          {GRADES.map((g) => (
            <button key={g.g} aria-pressed={grade === g.g} onClick={() => setGrade(g.g)}>
              {g.g} · {g.t}
            </button>
          ))}
        </div>
        <p className="gradehint">{hint}</p>
      </div>

      <div className="fld" style={{ marginBottom: ".9rem" }}>
        <label>Por que voltou (motivo real)</label>
        <select value={motivoReal} onChange={(e) => setMotivoReal(e.target.value)}>
          <option value="">— motivo real —</option>
          {MOTIVOS_REAIS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="fld">
        <label>Observação</label>
        <input type="text" placeholder="observação (opcional)" style={{ width: "100%" }}
          value={obs} onChange={(e) => setObs(e.target.value)} />
      </div>

      <div className="accbox">
        <p>Lembrete: o vídeo de abertura precisa ser uma tomada só — etiqueta com o pedido, lacre,
          balança, abertura, peça. Se veio divergente, a contestação é hoje.</p>
      </div>

      <div className="acts">
        <button onClick={onClose}>Cancelar</button>
        <button className="primary" onClick={() => onSalvar({ divergente, grade, motivoReal, obs })}>
          Dar baixa
        </button>
      </div>
    </Mask>
  );
}

export function Indenizacao({
  row, onClose, onSalvar,
}: { row: Devolucao; onClose: () => void; onSalvar: (valor: string, protocolo: string) => void }) {
  const [valor, setValor] = useState(String(row.valor || ""));
  const [protocolo, setProtocolo] = useState(row.protocolo || "");
  return (
    <Mask onClose={onClose}>
      <h2>Registrar indenização</h2>
      <p className="who">{row.canal} · pedido {row.pedido}</p>
      <div className="fld" style={{ marginBottom: ".9rem" }}>
        <label>Valor efetivamente creditado (R$)</label>
        <input type="text" style={{ width: "100%" }} value={valor} onChange={(e) => setValor(e.target.value)} />
      </div>
      <div className="fld">
        <label>Número do protocolo</label>
        <input type="text" style={{ width: "100%" }} value={protocolo} onChange={(e) => setProtocolo(e.target.value)} />
      </div>
      <div className="warnbox">
        <p>Confira contra a nota antes de aceitar. Proposta colada no valor do frete, ou abaixo do valor
          do anúncio, se discute — o teto está preso ao valor declarado.</p>
      </div>
      <div className="acts">
        <button onClick={onClose}>Cancelar</button>
        <button className="primary" onClick={() => onSalvar(valor, protocolo)}>Registrar</button>
      </div>
    </Mask>
  );
}

export function Chamado({
  row, onClose, onSalvar,
}: { row: Devolucao; onClose: () => void; onSalvar: (protocolo: string) => void }) {
  const [protocolo, setProtocolo] = useState(row.protocolo || "");
  return (
    <Mask onClose={onClose}>
      <h2>Abrir chamado de extravio</h2>
      <p className="who">{row.canal} · pedido {row.pedido} · rastreio {row.rastreio || "sem código"}</p>
      <div className="warnbox">
        <p>Antes de registrar: cole o código de rastreio no site da transportadora. Se voltou a andar,
          cancele — a caixa está vindo.</p>
      </div>
      <div className="fld">
        <label>Número do protocolo (anote quando a plataforma informar)</label>
        <input type="text" style={{ width: "100%" }} placeholder="opcional agora"
          value={protocolo} onChange={(e) => setProtocolo(e.target.value)} />
      </div>
      <div className="acts">
        <button onClick={onClose}>Cancelar</button>
        <button className="primary" onClick={() => onSalvar(protocolo)}>Registrar chamado</button>
      </div>
    </Mask>
  );
}

export function Detalhe({
  row, cfg, onClose, onAcao,
}: {
  row: Devolucao; cfg: Config; onClose: () => void;
  onAcao: (tipo: "reabrir" | "perda" | "indenizada") => void;
}) {
  const s = situacao(row, cfg);
  const linhas: [string, string][] = [
    ["Canal", row.canal], ["Pedido", row.pedido], ["Produto", row.produto || "—"],
    ["SKU", row.sku || "—"], ["Valor", brl(row.valor)], ["Motivo declarado", row.motivo || "—"],
    ["Comprador", row.comprador || "—"],
    ["Data da devolução", fmtDate(row.aprovadaEm)], ["Rastreio reverso", row.rastreio || "—"],
    ["Último evento", row.ultimoEventoEm || "—"], ["Status na plataforma", row.statusPlataforma || "—"],
    ["Situação", s.lab],
    ["Recebida em", row.recebidaEm || "—"], ["Grade", row.grade || "—"],
    ["Motivo real", row.motivoReal || "—"], ["Contestada em", row.contestadaEm || "—"],
    ["Chamado aberto em", row.chamadoEm || "—"], ["Protocolo", row.protocolo || "—"],
    ["Indenizada em", row.indenizadaEm || "—"],
    ["Valor indenizado", row.valorIndenizado ? brl(row.valorIndenizado) : "—"],
    ["Perda em", row.perdaEm || "—"], ["Observação", row.obs || "—"],
  ];
  return (
    <Mask onClose={onClose}>
      <h2>Detalhes da devolução</h2>
      <p className="who">{row.canal} · {row.pedido}</p>
      <div className="scroll">
        <table style={{ minWidth: 0 }}>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i}>
                <td style={{ color: "var(--muted)", fontSize: ".78rem", width: "42%" }}>{l[0]}</td>
                <td style={{ fontSize: ".82rem" }}>{l[1]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="acts">
        {row.estado !== "esperando" && <button onClick={() => onAcao("reabrir")}>Voltar para esperando</button>}
        {(row.estado === "esperando" || row.estado === "chamado") && (
          <>
            <button onClick={() => onAcao("indenizada")}>Indenizada</button>
            <button onClick={() => onAcao("perda")}>Perda assumida</button>
          </>
        )}
        <button className="primary" onClick={onClose}>Fechar</button>
      </div>
    </Mask>
  );
}
