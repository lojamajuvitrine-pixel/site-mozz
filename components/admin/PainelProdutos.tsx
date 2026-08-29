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
  const [estados, setEstados] = useState<Record<string, EstadoLinha>>(() =>
    Object.fromEntries(produtosIniciais.map((p) => [p.id, estadoInicial(p)]))
  );

  const totalSemFoto = useMemo(() => produtosIniciais.filter((p) => !p.imagem).length, [produtosIniciais]);
  const totalDesativadas = useMemo(() => produtosIniciais.filter((p) => !p.ativo).length, [produtosIniciais]);

  const listaFiltrada = useMemo(() => {
    const termo = normalizarTexto(busca.trim());
    return produtosIniciais.filter((p) => {
      if (soSemFoto && p.imagem) return false;
      if (soDesativadas && p.ativo) return false;
      if (!termo) return true;
      return normalizarTexto(p.nome).includes(termo) || normalizarTexto(p.marca).includes(termo);
    });
  }, [produtosIniciais, busca, soSemFoto, soDesativadas]);

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
      const confirmou = window.confirm(
        "Trocar o sistema de tamanho apaga as medidas já preenchidas nessa grade. Continuar?"
      );
      if (!confirmou) return;
    }
    atualizarEstado(linhaId, { medidasSistema: novoSistema, medidasValores: gradeVazia(novoSistema) });
  }

  function atualizarValorMedida(linhaId: string, tamanhoIndice: number, colunaIndice: number, valor: string) {
    const estado = estados[linhaId];
    const novosValores = estado.medidasValores.map((linha, i) =>
      i === tamanhoIndice ? linha.map((v, j) => (j === colunaIndice ? valor : v)) : linha
    );
    atualizarEstado(linhaId, { detalhesAberto: true, medidasValores: novosValores });
  }

  function limparDetalhes(linhaId: string) {
    const sistema = estados[linhaId].medidasSistema;
    atualizarEstado(linhaId, { medidasValores: gradeVazia(sistema), composicaoTexto: "" });
  }

  async function salvar(linha: LinhaProduto) {
    const estado = estados[linha.id];
    const precoDigitado = estado.precoEspecial.trim();

    let precoEspecial: number | null = null;
    if (precoDigitado) {
      const numero = Number(precoDigitado.replace(",", "."));
      if (!Number.isFinite(numero) || numero <= 0) {
        atualizarEstado(linha.id, { erro: "Preço inválido" });
        return;
      }
      precoEspecial = numero;
    }

    const medidasCustomizadas: TabelaMedidas | null = temAlgumaMedida(estado.medidasValores)
      ? {
          colunas: ["Tamanho", ...COLUNAS_MEDIDAS],
          linhas: tamanhosDoSistema(estado.medidasSistema).map((tamanho, i) => [
            tamanho,
            ...estado.medidasValores[i]
          ])
        }
      : null;

    const composicaoCustomizada = estado.composicaoTexto.trim() || null;

    atualizarEstado(linha.id, { salvando: true, erro: null });
    try {
      const resposta = await fetch("/api/admin/produtos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produtoId: linha.id,
          precoEspecial,
          destaque: estado.destaque,
          outlet: estado.outlet,
          ativo: estado.ativo,
          medidasCustomizadas,
          composicaoCustomizada
        })
      });
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null);
        throw new Error(corpo?.erro ?? "Não foi possível salvar");
      }
      setEstados((atual) => ({
        ...atual,
        [linha.id]: { ...atual[linha.id], salvando: false, salvoAgora: true }
      }));
    } catch (e) {
      atualizarEstado(linha.id, {
        salvando: false,
        erro: e instanceof Error ? e.message : "Não foi possível salvar"
      });
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou marca..."
          className="border border-black/20 px-3 py-2 text-[14.5px] w-full max-w-sm"
        />
        <label className="flex items-center gap-1.5 text-[13.5px] text-mozz-gray cursor-pointer">
          <input
            type="checkbox"
            checked={soSemFoto}
            onChange={(e) => setSoSemFoto(e.target.checked)}
            className="w-4 h-4"
          />
          Só sem foto ({totalSemFoto})
        </label>
        <label className="flex items-center gap-1.5 text-[13.5px] text-mozz-gray cursor-pointer">
          <input
            type="checkbox"
            checked={soDesativadas}
            onChange={(e) => setSoDesativadas(e.target.checked)}
            className="w-4 h-4"
          />
          Só desativadas ({totalDesativadas})
        </label>
      </div>
      <p className="text-[13px] text-mozz-gray mb-4">
        Peça sem foto fica automaticamente fora do catálogo até alguém subir a foto no Bling - não
        precisa ativar nada aqui depois, é só o próximo sync que já mostra ela pro cliente.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-[13.5px] border-collapse">
          <thead>
            <tr className="border-b border-black/10 text-left text-mozz-gray">
              <th className="py-2 pr-3 font-normal">Peça</th>
              <th className="py-2 pr-3 font-normal">Preço Bling</th>
              <th className="py-2 pr-3 font-normal">Desconto</th>
              <th className="py-2 pr-3 font-normal">Preço especial</th>
              <th className="py-2 pr-3 font-normal text-center">Destaque</th>
              <th className="py-2 pr-3 font-normal text-center">Outlet</th>
              <th className="py-2 pr-3 font-normal text-center">Ativa</th>
              <th className="py-2 pr-3 font-normal">Composição / medidas</th>
              <th className="py-2 pr-3 font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {listaFiltrada.map((linha) => {
              const estado = estados[linha.id];
              if (!estado) return null;
              const temAlgumCustomizado = !!linha.medidasSalvas || linha.composicaoCustomizada;
              return (
                <Fragment key={linha.id}>
                  <tr className={`border-b border-black/5 align-middle ${!estado.ativo ? "opacity-50" : ""}`}>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="relative w-10 h-12 bg-mozz-stone shrink-0 overflow-hidden">
                          {linha.imagem && (
                            <Image src={linha.imagem} alt="" fill sizes="40px" className="object-cover" />
                          )}
                        </div>
                        <div>
                          <p className="leading-tight">{linha.nome}</p>
                          <p className="text-mozz-gray text-[12px]">
                            {linha.marca}
                            {!linha.imagem && (
                              <span className="ml-2 text-red-600 border border-red-600 px-1 py-0.5 text-[11px]">
                                sem foto
                              </span>
                            )}
                            {!estado.ativo && (
                              <span className="ml-2 text-red-600 border border-red-600 px-1 py-0.5 text-[11px]">
                                desativada
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-mozz-gray whitespace-nowrap">
                      {formatarPreco(linha.precoBling)}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-1">
                        <input
                          value={estado.percentual}
                          onChange={(e) => aplicarPercentual(linha, e.target.value)}
                          placeholder="0"
                          inputMode="decimal"
                          title="Percentual de desconto - calcula o preço especial ao lado"
                          className="border border-black/20 px-2 py-1.5 text-[13.5px] w-14"
                        />
                        <span className="text-mozz-gray text-[12.5px]">%</span>
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        value={estado.precoEspecial}
                        onChange={(e) => atualizarEstado(linha.id, { precoEspecial: e.target.value, percentual: "" })}
                        placeholder="Sem oferta"
                        inputMode="decimal"
                        className="border border-black/20 px-2 py-1.5 text-[13.5px] w-24"
                      />
                    </td>
                    <td className="py-2 pr-3 text-center">
                      <input
                        type="checkbox"
                        checked={estado.destaque}
                        onChange={(e) => atualizarEstado(linha.id, { destaque: e.target.checked })}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="py-2 pr-3 text-center">
                      <input
                        type="checkbox"
                        checked={estado.outlet}
                        onChange={(e) => atualizarEstado(linha.id, { outlet: e.target.checked })}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="py-2 pr-3 text-center">
                      <input
                        type="checkbox"
                        checked={estado.ativo}
                        onChange={(e) => atualizarEstado(linha.id, { ativo: e.target.checked })}
                        title="Desmarque pra tirar essa peça do catálogo público"
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <button
                        onClick={() => atualizarEstado(linha.id, { detalhesAberto: !estado.detalhesAberto })}
                        className="text-[12.5px] underline underline-offset-2"
                      >
                        {estado.detalhesAberto ? "Fechar" : temAlgumCustomizado ? "Editar" : "Cadastrar"}
                      </button>
                      {temAlgumCustomizado && !estado.detalhesAberto && (
                        <span className="text-[11px] text-mozz-gray ml-1.5">real</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <button
                        onClick={() => salvar(linha)}
                        disabled={estado.salvando}
                        className="text-[12.5px] px-3 py-1.5 bg-mozz-black text-white disabled:opacity-50"
                      >
                        {estado.salvando ? "Salvando..." : "Salvar"}
                      </button>
                      {estado.salvoAgora && <span className="text-[12px] text-mozz-gray ml-2">Salvo</span>}
                      {estado.erro && <span className="text-[12px] text-red-600 ml-2">{estado.erro}</span>}
                    </td>
                  </tr>
                  {estado.detalhesAberto && (
                    <tr className="border-b border-black/5 bg-mozz-stone/40">
                      <td colSpan={9} className="py-3 px-3">
                        <div className="mb-4">
                          <p className="text-[13px] mb-1">Composição</p>
                          <p className="text-[12.5px] text-mozz-gray mb-2">
                            Texto livre (ex: "70% Algodão, 30% Poliéster"). Já vem preenchido com o
                            que a página do produto mostra hoje - troque pela composição real dessa
                            peça, ou apague pra voltar a usar o que vier do Bling/genérico.
                          </p>
                          <input
                            value={estado.composicaoTexto}
                            onChange={(e) => atualizarEstado(linha.id, { detalhesAberto: true, composicaoTexto: e.target.value })}
                            placeholder={linha.composicaoAtual}
                            className="w-full max-w-lg border border-black/20 px-3 py-2 text-[13.5px]"
                          />
                        </div>
                        <div>
                          <p className="text-[13px] mb-1">Tabela de medidas</p>
                          <p className="text-[12.5px] text-mozz-gray mb-2">
                            Escolha o sistema de tamanho e preencha as medidas de cada um (em cm).
                            Célula em branco fica em branco na página do produto - só preencha o que
                            tiver certeza.
                          </p>
                          <div className="flex items-center gap-4 mb-3">
                            <label className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                              <input
                                type="radio"
                                name={`sistema-${linha.id}`}
                                checked={estado.medidasSistema === "letra"}
                                onChange={() => trocarSistema(linha.id, "letra")}
                                className="w-3.5 h-3.5"
                              />
                              PP, P, M, G, GG, GGG
                            </label>
                            <label className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                              <input
                                type="radio"
                                name={`sistema-${linha.id}`}
                                checked={estado.medidasSistema === "numerico"}
                                onChange={() => trocarSistema(linha.id, "numerico")}
                                className="w-3.5 h-3.5"
                              />
                              34, 36, 38, 40, 42, 44
                            </label>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="text-[12.5px] border-collapse">
                              <thead>
                                <tr>
                                  <th className="py-1 pr-2 text-left font-normal text-mozz-gray">Tamanho</th>
                                  {COLUNAS_MEDIDAS.map((coluna) => (
                                    <th key={coluna} className="py-1 pr-2 text-left font-normal text-mozz-gray whitespace-nowrap">
                                      {coluna}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {tamanhosDoSistema(estado.medidasSistema).map((tamanho, tamanhoIndice) => (
                                  <tr key={tamanho}>
                                    <td className="py-1 pr-2 font-medium">{tamanho}</td>
                                    {COLUNAS_MEDIDAS.map((_, colunaIndice) => (
                                      <td key={colunaIndice} className="py-1 pr-2">
                                        <input
                                          value={estado.medidasValores[tamanhoIndice]?.[colunaIndice] ?? ""}
                                          onChange={(e) =>
                                            atualizarValorMedida(linha.id, tamanhoIndice, colunaIndice, e.target.value)
                                          }
                                          inputMode="decimal"
                                          className="border border-black/20 px-1.5 py-1 text-[12.5px] w-16"
                                        />
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            onClick={() => salvar(linha)}
                            disabled={estado.salvando}
                            className="text-[12.5px] px-3 py-1.5 bg-mozz-black text-white disabled:opacity-50"
                          >
                            {estado.salvando ? "Salvando..." : "Salvar"}
                          </button>
                          {(temAlgumaMedida(estado.medidasValores) || estado.composicaoTexto.trim()) && (
                            <button
                              onClick={() => limparDetalhes(linha.id)}
                              className="text-[12.5px] text-mozz-gray underline underline-offset-2"
                            >
                              Limpar os dois (volta a usar o padrão)
                            </button>
                          )}
                          {estado.erro && <span className="text-[12px] text-red-600">{estado.erro}</span>}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {listaFiltrada.length === 0 && (
        <p className="text-[14.5px] text-mozz-gray py-8 text-center">Nenhuma peça encontrada.</p>
      )}
    </div>
  );
}
