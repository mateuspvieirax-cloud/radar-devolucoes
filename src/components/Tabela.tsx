"use client";
import React from "react";
import { brl, fmtDate, parado, situacao, soma } from "@/lib/domain";
import type { Config, Devolucao } from "@/lib/types";

export function Tile({ lab, big, sm, cls }: { lab: string; big: string; sm?: string; cls?: string }) {
  return (
    <div className={"tile " + (cls || "")}>
      <div className="lab"><span className="stripe" />{lab}</div>
      <div className="big">{big}</div>
      <div className="sm">{sm || ""}</div>
    </div>
  );
}

export interface Acao { l: string; primary?: boolean; fn: (r: Devolucao) => void }

export function Tabela({
  rows, cfg, acoes, onDetalhe,
}: {
  rows: Devolucao[];
  cfg: Config;
  acoes?: (r: Devolucao) => Acao[];
  onDetalhe: (r: Devolucao) => void;
}) {
  if (!rows.length) return null;
  return (
    <div className="scroll">
      <table>
        <thead>
          <tr>
            {["Canal", "Pedido", "Produto", "Valor", "Devolvida", "Rastreio", "Parado", "Situação", ""].map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const s = situacao(r, cfg);
            const d = parado(r);
            const dcls = s.k === "extravio" ? "crit" : s.k === "risco" || s.k === "chegou" ? "warn" : "";
            return (
              <tr key={r.id}>
                <td><span className="pill canal">{r.canal.split(" ")[0]}</span></td>
                <td><span className="mono">{r.pedido}</span></td>
                <td>
                  <span className="prod">{r.produto || "—"}</span>
                  <span className="sku">{(r.sku || "") + (r.motivo ? " · " + r.motivo : "")}</span>
                </td>
                <td className="num">{r.valor ? brl(r.valor) : "—"}</td>
                <td className="num mono">{fmtDate(r.aprovadaEm)}</td>
                <td><span className="trk">{r.rastreio || "—"}</span></td>
                <td className="num">
                  <span className={"days " + dcls}>{r.estado === "esperando" ? d + "d" : "—"}</span>
                </td>
                <td><span className={"pill " + s.cls}>{s.lab}</span></td>
                <td className="acts">
                  {(acoes ? acoes(r) : []).map((a, i) => (
                    <button key={i} className={"tiny" + (a.primary ? " primary" : "")} onClick={() => a.fn(r)}>
                      {a.l}
                    </button>
                  ))}
                  <button className="ghost tiny" title="Detalhes" onClick={() => onDetalhe(r)}>⋯</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Grupo({
  cls, titulo, porque, rows, cfg, acoes, onDetalhe,
}: {
  cls: string; titulo: string; porque: string; rows: Devolucao[]; cfg: Config;
  acoes?: (r: Devolucao) => Acao[]; onDetalhe: (r: Devolucao) => void;
}) {
  if (!rows.length) return null;
  return (
    <div className={"grp " + cls}>
      <header>
        <h2>{titulo}</h2>
        <span className="why">{porque}</span>
        <span className="tot">{rows.length} · {brl(soma(rows))}</span>
      </header>
      <Tabela rows={rows} cfg={cfg} acoes={acoes} onDetalhe={onDetalhe} />
    </div>
  );
}

export function Vazio({ titulo, texto, cls }: { titulo: string; texto?: string; cls?: string }) {
  return (
    <div className={"grp " + (cls || "")}>
      <div className="empty">
        <b>{titulo}</b>
        {texto ? <div>{texto}</div> : null}
      </div>
    </div>
  );
}
