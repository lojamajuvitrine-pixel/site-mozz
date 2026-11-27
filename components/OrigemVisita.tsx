"use client";

import { useEffect } from "react";
import { registrarOrigemVisita } from "@/lib/origemVisita";

// 27/11/2026: grava de onde a cliente chegou (ver lib/origemVisita.ts). Nao mostra nada na tela.
export default function OrigemVisita() {
  useEffect(() => {
    registrarOrigemVisita();
  }, []);
  return null;
}
