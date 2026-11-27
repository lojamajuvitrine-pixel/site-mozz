"use client";

import { useEffect } from "react";
import { rastrearContatoWhatsapp, rastrearEntrarGrupoVip } from "@/lib/tracking";

// "Vigia" unico de cliques no WhatsApp: em vez de colocar rastreio em cada botao (fixo, menu,
// rodape, Quem Somos, Preco Garantido...), escuta todos os cliques do site e, se o link clicado
// abre o WhatsApp, avisa GA4/Pixel. Botoes novos de WhatsApp ja' entram automaticamente.
// Nao renderiza nada na tela.
export default function RastreioWhatsapp() {
  useEffect(() => {
    function aoClicar(evento: MouseEvent) {
      const alvo = evento.target as Element | null;
      const link = alvo?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.href || "";
      const origem = window.location.pathname;
      if (/^https?:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(href)) {
        rastrearContatoWhatsapp(origem);
      } else if (/^https?:\/\/chat\.whatsapp\.com\//i.test(href)) {
        rastrearEntrarGrupoVip(origem);
      }
    }
    // capture: true pra pegar o clique antes de o navegador abrir o WhatsApp
    document.addEventListener("click", aoClicar, true);
    return () => document.removeEventListener("click", aoClicar, true);
  }, []);
  return null;
}
