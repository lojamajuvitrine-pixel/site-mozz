"use client";

import { useEffect, useState } from "react";

// Contagem regressiva da Black Friday (horas, minutos, segundos). Quando o tempo acaba,
// recarrega a pagina uma vez - assim quem estiver olhando na hora da abertura ja' cai na vitrine.
function partes(restanteMs: number) {
  const total = Math.max(0, Math.floor(restanteMs / 1000));
  return {
    // sempre em horas, sem dias (pedido do Brunno em 20/11/2026): 7 dias = 168 horas
    horas: Math.floor(total / 3600),
    minutos: Math.floor((total % 3600) / 60),
    segundos: total % 60
  };
}

export default function ContagemRegressiva({
  alvo,
  compacta = false,
  recarregarAoFim = true
}: {
  alvo: string;
  compacta?: boolean;
  recarregarAoFim?: boolean;
}) {
  const alvoMs = Date.parse(alvo);
  const [agora, setAgora] = useState<number | null>(null);

  useEffect(() => {
    setAgora(Date.now());
    const id = setInterval(() => {
      const t = Date.now();
      setAgora(t);
      if (t >= alvoMs) {
        clearInterval(id);
        if (recarregarAoFim) setTimeout(() => window.location.reload(), 1500);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [alvoMs, recarregarAoFim]);

  const { horas, minutos, segundos } = partes(agora === null ? 0 : alvoMs - agora);
  const carregando = agora === null;
  const doisDigitos = (n: number) => String(n).padStart(2, "0");

  const caixas = [
    { valor: horas, rotulo: "Horas" },
    { valor: minutos, rotulo: "Min" },
    { valor: segundos, rotulo: "Seg" }
  ];

  if (compacta) {
    return (
      <span className="font-mono tabular-nums">
        {carregando ? "--:--:--" : `${doisDigitos(horas)}:${doisDigitos(minutos)}:${doisDigitos(segundos)}`}
      </span>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {caixas.map((c) => (
        <div key={c.rotulo} className="rounded-lg border border-[#C9A24B]/40 bg-white/5 py-3 sm:py-4 text-center">
          <p className="text-3xl sm:text-4xl font-semibold tabular-nums text-white">
            {carregando ? "--" : doisDigitos(c.valor)}
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-[#C9A24B]">{c.rotulo}</p>
        </div>
      ))}
    </div>
  );
}
