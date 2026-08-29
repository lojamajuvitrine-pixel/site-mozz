"use client";

import { Fragment, useMemo, useState } from "react";
import Image from "next/image";
import { formatarPreco } from "@/lib/formato";
import { normalizarTexto } from "@/lib/cor";
import { csvParaTabela } from "@/lib/detalhesProduto";

type LinhaProduto = {
  id: string;
  nome: string;
  marca: string;
  imagem: string | null;
  precoBling: number;
  precoEspecialAtual: number | null;
  destaque: boolean;
  outlet: boolean;
  // true = essa peca ja tem tabela de medidas REAL salva (nao so' a generica de referencia).
  medidasCustomizada: boolean;
  // CSV pronto pra' cair na textarea: a tabela customizada se ja existir, senao a generica
  // da categoria como ponto de partida (ver app/admin/produtos/page.tsx).
  medidasCsv: string;
  // true = essa peca ja tem composicao REAL salva (nao so' a do Bling/generica).
  composicaoCustomizada: boolean;
  // Texto pronto pra' cair no input: a composicao customizada se ja existir, senao o que a
  // pagina do produto mostraria hoje (do Bling, ou generica da categoria) - so' de sugestao.
  composicaoAtual: string;
};

type EstadoLinha = {
  precoEspecial: string; // valor do input, como texto - vazio = sem oferta
  percentual: string; // so' uma calculadora auxiliar - preenche o preco especial acima, nao e' salvo
  destaque: boolean;
  outlet: boolean;
  medidasTexto: string;
  composicaoTexto: string;
  detalhesAberto: boolean;
  salvando: boolean;
  erro: string | null;
  salvoAgora: boolean;
};

function estadoInicial(linha: LinhaProduto): EstadoLinha {
  return {
    precoEspecial: linha.precoEspecialAtual !== null ? String(linha.precoEspecialAtual) : "",
    percentual: "",
    destaque: linha.destaque,
    outlet: linha.outlet,
    // So' pre-preenche o texto se for um valor REAL ja salvo - se for so' a sugestao (tabela
    // generica ou composicao do Bling/generica), comeca vazio (mostrado como placeholder),
    // pra nunca dar a entender que a sugestao ja foi "salva" como se fosse a real da peca.
    medidasTexto: linha.medidasCustomizada ? linha.medidasCsv : "",
    composicaoTexto: linha.composicaoCustomizada ? linha.composicaoAtual : "",
    detalhesAberto: false,
    salvando: false,
    erro: null,
    salvoAgora: false
  };
}

// Calcula o preco especial a partir de um % de desconto em cima do preco do Bling - so'
// preenche o campo de preco (que continua sendo o unico valor de fato salvo), pra quem
// prefere pensar em "20% off" em vez de calcular o valor final na mao.
function precoComDesconto(precoBling: number, percentualTexto: string): string | null {
  const percentual = Number(percentualTexto.replace(",", "."));
  if (!Number.isFinite(percentual) || percentual <= 0 || percentual >= 100) return null;
  const precoComDesconto = precoBling * (1 - percentual / 100);
  return precoComDesconto.toFixed(2);
}

// Painel administrativo (client component) - lista todo o catalogo com busca, e por linha
// deixa configurar preco especial (input livre, vazio = sem oferta), destaque (aparece
// priorizado na vitrine "Novidades" da home), outlet (aparece na aba /outlet), composicao e
// tabela de medidas reais da peca. Cada linha salva de forma independente, direto em
// /api/admin/produtos.
export default function PainelProdutos({ produtosIniciais }: { produtosIniciais: LinhaProduto[] }) {
  const [busca, setBusca] = useState("");
  // pecas sem foto ficam FORA do catalogo publico ate' alguem subir a foto no Bling (ver
  // lib/produtos.ts) - esse filtro ajuda a achar rapido quem falta fotografar/subir foto.
  const [soSemFoto, setSoSemFoto] = useState(false);
  const [estados, setEstados] = useState<Record<string, EstadoLinha>>(() =>
    Object.fromEntries(produtosIniciais.map((p) => [p.id, estadoInicial(p)]))
  );

  const totalSemFoto = useMemo(() => produtosIniciais.filter((p) => !p.imagem).length, [produtosIniciais]);

  const listaFiltrada = useMemo(() => {
    const termo = normalizarTexto(busca.trim());
    return produtosIniciais.filter((p) => {
      if (soSemFoto && p.imagem) return false;
      if (!termo) return true;
      return normalizarTexto(p.nome).includes(termo) || normalizarTexto(p.marca).includes(termo);
    });
  }, [produtosIniciais, busca, soSemFoto]);

  function atualizarEstado(id: string, alteracao: Partial<EstadoLinha>) {
    setEstados((atual) => ({ ...atual, [id]: { ...atual[id], ...alteracao, salvoAgora: false, erro: null } }));
  }

  // Digitou um % de desconto - calcula o preco final e joga direto no campo de preco
  // especial (que continua editavel na mao depois, se quiser ajustar um centavo pra cima ou
  // pra baixo).
  function aplicarPercentual(linha: LinhaProduto, percentualTexto: string) {
    const precoCalculado = precoComDesconto(linha.precoBling, percentualTexto);
    atualizarEstado(linha.id, {
      percentual: percentualTexto,
      ...(precoCalculado ? { precoEspecial: precoCalculado } : {})
    });
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

    // Vazio = sem tabela customizada (volta pra generica da categoria). Se tiver texto,
    // precisa ser uma tabela valida (cabecalho + linhas com o mesmo numero de colunas) -
    // valida AQUI, antes de gastar uma chamada de rede, pra dar o erro na hora.
    let medidasCustomizadas: { colunas: string[]; linhas: string[][] } | null = null;
    const medidasTexto = estado.medidasTexto.trim();
    if (medidasTexto) {
      const resultado = csvParaTabela(medidasTexto);
      if (!resultado.tabela) {
        atualizarEstado(linha.id, { erro: resultado.erro ?? "Tabela de medidas inválida", detalhesAberto: true });
        return;
      }
      medidasCustomizadas = resultado.tabela;
    }

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
              <th className="py-2 pr-3 font-normal">Composição / medidas</th>
              <th className="py-2 pr-3 font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {listaFiltrada.map((linha) => {
              const estado = estados[linha.id];
              if (!estado) return null;
              const temAlgumCustomizado = linha.medidasCustomizada || linha.composicaoCustomizada;
              return (
                <Fragment key={linha.id}>
                  <tr className="border-b border-black/5 align-middle">
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
                      <td colSpan={8} className="py-3 px-3">
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
                            Uma linha por tamanho, valores separados por vírgula. Primeira linha é
                            o cabeçalho. Já vem preenchido com a tabela genérica de referência
                            dessa categoria - troque pelos números reais dessa peça, ou apague
                            tudo pra voltar a usar a genérica.
                          </p>
                          <textarea
                            value={estado.medidasTexto}
                            onChange={(e) => atualizarEstado(linha.id, { detalhesAberto: true, medidasTexto: e.target.value })}
                            placeholder={linha.medidasCsv || "Tamanho, Busto (cm), Cintura (cm), Quadril (cm)\n36, 84, 64, 92"}
                            rows={5}
                            className="w-full max-w-lg border border-black/20 px-3 py-2 text-[13px] font-mono"
                          />
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            onClick={() => salvar(linha)}
                            disabled={estado.salvando}
                            className="text-[12.5px] px-3 py-1.5 bg-mozz-black text-white disabled:opacity-50"
                          >
                            {estado.salvando ? "Salvando..." : "Salvar"}
                          </button>
                          {(estado.medidasTexto.trim() || estado.composicaoTexto.trim()) && (
                            <button
                              onClick={() => atualizarEstado(linha.id, { medidasTexto: "", composicaoTexto: "" })}
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
