"use client";
import React, { useState } from "react";
import { CANAIS, DEFAULT_CONFIG, type Config } from "@/lib/types";

export default function Ajustes({ cfg, onSalvar }: { cfg: Config; onSalvar: (c: Config) => Promise<void> }) {
  const [local, setLocal] = useState<Config>(cfg);
  const [estado, setEstado] = useState<"parado" | "salvando" | "salvo" | "erro">("parado");

  function set(canal: string, campo: "alerta" | "extravio" | "contestar", valor: string) {
    const n = parseInt(valor, 10);
    setLocal((c) => ({
      ...c,
      [canal]: { ...(c[canal] || DEFAULT_CONFIG[canal]), [campo]: Number.isFinite(n) ? n : 1 },
    }));
    setEstado("parado");
  }

  async function salvar() {
    setEstado("salvando");
    try { await onSalvar(local); setEstado("salvo"); }
    catch { setEstado("erro"); }
  }

  return (
    <div>
      <div className="panel">
        <h2>Prazos por canal</h2>
        <p className="help">
          Dias sem movimento no rastreio reverso até a devolução entrar em risco, e até virar provável
          extravio. Comece com estes valores e ajuste quando tiver os prazos reais do seu painel — o
          número que vale é o do painel, não o da política geral.
        </p>
        {CANAIS.map((c) => {
          const v = local[c] || DEFAULT_CONFIG[c];
          return (
            <div className="cfgrow" key={c}>
              <div className="cn">{c}</div>
              <div className="fld">
                <label>em risco (dias)</label>
                <input type="number" min={1} max={90} value={v.alerta} onChange={(e) => set(c, "alerta", e.target.value)} />
              </div>
              <div className="fld">
                <label>extravio (dias)</label>
                <input type="number" min={1} max={90} value={v.extravio} onChange={(e) => set(c, "extravio", e.target.value)} />
              </div>
              <div className="fld">
                <label>contestar (dias)</label>
                <input type="number" min={1} max={90} value={v.contestar} onChange={(e) => set(c, "contestar", e.target.value)} />
              </div>
            </div>
          );
        })}
        <div className="row" style={{ marginTop: "1rem" }}>
          <button className="primary" onClick={salvar} disabled={estado === "salvando"}>
            {estado === "salvando" ? "Salvando…" : "Salvar prazos"}
          </button>
          <span className="syncmsg">
            {estado === "salvo" ? "salvo" : estado === "erro" ? "não deu para salvar" : ""}
          </span>
        </div>
      </div>

      <div className="panel">
        <h2>Backup</h2>
        <p className="help">
          Os dados ficam no Firestore, então não somem se o computador der problema. Ainda assim,
          exporte o CSV toda semana — é o arquivo que abre no Excel e o que você manda para o contador.
        </p>
        <div className="linkbar">
          <a className="btnlink" href="/api/export">Exportar CSV</a>
        </div>
      </div>

      <div className="panel">
        <h2>Como isso funciona</h2>
        <ol style={{ margin: 0, paddingLeft: "1.2rem", fontSize: ".87rem", lineHeight: 1.75, maxWidth: "70ch" }}>
          <li>Você importa o relatório de devoluções de cada canal. Cada devolução aprovada vira uma linha esperada — antes de existir caixa nenhuma.</li>
          <li>A cada dia o Radar conta há quantos dias o rastreio reverso está parado e separa o que precisa de ação.</li>
          <li>Quando a caixa chega, você bipa. A bipagem dá baixa e abre a conferência: OK ou divergente, grade e motivo real.</li>
          <li>Divergente vira ação de contestar com prazo curto. O que não chega vira chamado de extravio, e depois indenização ou perda assumida.</li>
          <li>O que sobra sem baixa é exatamente o buraco que hoje ninguém enxerga.</li>
        </ol>
      </div>
    </div>
  );
}
