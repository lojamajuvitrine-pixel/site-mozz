"use client";

import { Fragment, useMemo, useState } from "react";
import Image from "next/image";
import { formatarPreco } from "@/lib/formato";
import { normalizarTexto } from "@/lib/cor";
import {
  COLUNAS_MEDIDAS,
  SISTEMA_TAMANHO_LETRA,
  SISTEMA_TAMANHO_NUMERICO,
  sistemaDaTabela,
  type SistemaTamanho,
  type TabelaMedidas
} from "@/lib/detalhesProduto";

type LinhaProduto = {
  id: string;
  nome: string;
  marca: string;
  imagem: string | null;
  precoBling: number;
  precoEspecialAtual: number | null;
  destaque: boolean;
  outlet: boolean;
  ativo: boolean;
  medidasSalvas: TabelaMedidas | null;
  composicaoCustomizada: boolean;
  composicaoAtual: string;
  // cores + fotos do produto (ja' com a escolha atual de "1a foto" aplicada) e o mapa cru
  // salvo no Supabase - ver "Ordem das fotos" mais abaixo.
  cores: { cor: string; imagens: string[] }[];
  capaPorCorSalva: Record<string, string> | null;
};

type EstadoLinha = {
  precoEspecial: string;
  percentual: string;
  destaque: boolean;
  outlet: boolean;
  ativo: boolean;
  medidasSistema: SistemaTamanho;
  medidasValores: string[][];
  composicaoTexto: string;
  // Escolha de "1a foto" por cor, cor -> caminho da imagem. Comeca com o que ja' esta' salvo
  // (pra nao apagar a escolha de uma cor so' porque o Brunno mexeu em outro campo e salvou).
  capaPorCor: Record<string, string>;
  detalhesAberto: boolean;
  salvando: boolean;
  erro: string | null;
  salvoAgora: boolean;
};

function tamanhosDoSistema(sistema: SistemaTamanho): readonly string[] {
  return sistema === "letra" ? SISTEMA_TAMANHO_LETRA : SISTEMA_TAMANHO_NUMERICO;
}

function gradeVazia(sistema: SistemaTamanho): string[][] {
  return tamanhosDoSistema(sistema).map(() => COLUNAS_MEDIDAS.map(() => ""));
}

function medidasIniciais(tabela: TabelaMedidas | null): { sistema: SistemaTamanho; valores: string[][] } {
  if (!tabela) return { sistema: "letra", valores: gradeVazia("letra") };
  const sistema = sistemaDaTabela(tabela);
  const tamanhos = tamanhosDoSistema(sistema);
  const valores = tamanhos.map((tamanho) => {
    const linha = tabela.linhas.find((l) => l[0] === tamanho);
    if (!linha) return COLUNAS_MEDIDAS.map(() => "");
    return COLUNAS_MEDIDAS.map((_, indice) => linha[indice + 1] ?? "");
  });
  return { sistema, valores };
}

function temAlgumaMedida(valores: string[][]): boolean {
  return valores.some((linha) => linha.some((valor) => valor.trim() !== ""));
}

function estadoInicial(linha: LinhaProduto): EstadoLinha {
  const { sistema, valores } = medidasIniciais(linha.medidasSalvas);
  return {
    precoEspecial: linha.precoEspecialAtual !== null ? String(linha.precoEspecialAtual) : "",
    percentual: "",
    destaque: linha.destaque,
    outlet: linha.outlet,
    ativo: linha.ativo,
    medidasSistema: sistema,
    medidasValores: valores,
    composicaoTexto: linha.composicaoCustomizada ? linha.composicaoAtual : "",
    capaPorCor: linha.capaPorCorSalva ?? {},
    detalhesAberto: false,
    salvando: false,
    erro: null,
    salvoAgora: false
  };
}

function precoComDesconto(precoBling: number, percentualTexto: string): string | null {
  const percentual = Number(percentualTexto.replace(",", "."));
  if (!Number.isFinite(percentual) || percentual <= 0 || percentual >= 100) return null;
  const precoComDesconto = precoBling * (1 - percentual / 100);
  return precoComDesconto.toFixed(2);
}

export default function PainelProdutos({ produtosIniciais }: { produtosIniciais: LinhaProduto[] }) {
  const [busca, setBusca] = useState("");
  const [soSemFoto, setSoSemFoto] = useState(false);
  const [soDesativadas, setSoDesativadas] = useState(false);
  const [marcaFiltro, setMarcaFiltro] = useState("");
  const [estados, setEstados] = useState<Record<string, EstadoLinha>>(() =>
    Object.fromEntries(produtosIniciais.map((p) => [p.id, estadoInicial(p)]))
  );

  const totalSemFoto = useMemo(() => produtosIniciais.filter((p) => !p.imagem).length, [produtosIniciais]);
  const totalDesativadas = useMemo(() => produtosIniciais.filter((p) => !p.ativo).length, [produtosIniciais]);

  // Lista de marcas presentes no catalogo agora, com quantas pecas cada uma tem - pra montar o
  // filtro abaixo e o Brunno ver de cara onde tem mais peca pra revisar. Ordem alfabetica.
  const marcasDisponiveis = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const p of produtosIniciais) {
      contagem.set(p.marca, (contagem.get(p.marca) ?? 0) + 1);
    }
    return Array.from(contagem.entries()).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [produtosIniciais]);

  const listaFiltrada = useMemo(() => {
    const termo = normalizarTexto(busca.trim());
    return produtosIniciais.filter((p) => {
      if (marcaFiltro && p.marca !== marcaFiltro) return false;
      if (soSemFoto && p.imagem) return false;
      if (soDesativadas && p.ativo) return false;
      if (!termo) return true;
      return normalizarTexto(p.nome).includes(termo) || normalizarTexto(p.marca).includes(termo);
    });
  }, [produtosIniciais, busca, soSemFoto, soDesativadas, marcaFiltro]);

  function atualizarEstado(id: string, alteracao: Partial<EstadoLinha>) {
    setEstados((atual) => ({ ...atual, [id]: { ...atual[id], ...alteracao, salvoAgora: false, erro: null } }));
  }

  function aplicarPercentual(linha: LinhaProduto, percentualTexto: string) {
    const precoCalculado = precoComDesconto(linha.precoBling, percentualTexto);
    atualizarEstado(linha.id, {
      percentual: percentualTexto,
      ...(precoCalculado ? { precoEspecial: precoCalculado } : {})
    });
  }

  function trocarSistema(linhaId: string, novoSistema: SistemaTamanho) {
    const estado = estados[linhaId];
    if (estado.medidasSistema === novoSistema) return;
    if (temAlgumaMedida(estado.medidasValores)) {
