"use client";

import { useMemo, useState } from "react";
import { formatarPreco } from "@/lib/formato";

export type PecaBlack = {
  id: string;
  nome: string;
  marca: string;
  imagem: string | null;
  precoCheio: number;
  precoBlack: number | null;
};

export type CadastroBlack = {
  nome: string;
  whatsapp: string;
  email: string;
  criado_em: string;
  email_acesso_enviado_em: string | null;
};

const POR_PAGINA = 60;
const DESCONTOS_RAPIDOS = [20, 30, 40, 50];

function formatarWhatsapp(numero: string): string {
  const d = numero.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return numero;
}

function percentual(cheio: number, black: number | null): number | null {
  if (!black || black >= cheio) return null;
  return Math.round((1 - black / cheio) * 100);
}

function LinhaPeca({ peca, aoSalvar }: { peca: PecaBlack; aoSalvar: (id: string, preco: number | null) => void }) {
  const [valor, setValor] = useState(peca.precoBlack ? String(peca.precoBlack).replace(".", ",") : "");
  const [estado, setEstado] = useState<"" | "salvando" | "salvo" | "erro">("");
  const [erro, setErro] = useState("");

  const precoDigitado = valor.trim() ? Number(valor.replace(/\./g, "").replace(",", ".")) : null;
  const off = percentual(peca.precoCheio, precoDigitado);

  async function salvar(preco: number | null) {
    if (preco !== null && (!Number.isFinite(preco) || preco <= 0 || preco >= peca.precoCheio)) {
      setEstado("erro");
      setErro("O preço da Black precisa ser maior que zero e menor que o preço cheio.");
      return;
    }
    setEstado("salvando");
    setErro("");
    try {
      const resposta = await fetch("/api/admin/black-friday/produto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produtoId: peca.id, preco })
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(dados.erro ?? "Erro ao salvar");
      if (preco === null) setValor("");
      setEstado("salvo");
      aoSalvar(peca.id, preco);
    } catch (falha) {
      setEstado("erro");
      setErro(falha instanceof Error ? falha.message : "Erro ao salvar");
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-3 border-b border-black/10 py-3 ${peca.precoBlack ? "bg-yellow-50" : ""}`}>
      <div className="h-16 w-12 flex-none overflow-hidden bg-mozz-stone">
        {peca.imagem && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={peca.imagem} alt="" className="h-full w-full object-cover" loading="lazy" />
        )}
      </div>
      <div className="min-w-[180px] flex-1">
        <p className="text-[14px] leading-snug">{peca.nome}</p>
        <p className="text-[12.5px] text-mozz-gray">
          {peca.marca} · cheio {formatarPreco(peca.precoCheio)}
          {peca.precoBlack ? ` · na Black por ${formatarPreco(peca.precoBlack)}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {DESCONTOS_RAPIDOS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setValor((Math.round(peca.precoCheio * (1 - d / 100) * 100) / 100).toFixed(2).replace(".", ","))}
            className="rounded border border-black/20 px-2 py-1 text-[12px] hover:bg-black/5"
          >
            -{d}%
          </button>
        ))}
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="Preço Black"
          inputMode="decimal"
          className="w-28 rounded border border-black/20 px-2 py-1.5 text-[14px]"
        />
        <span className="w-14 text-[13px] text-mozz-gray">{off !== null ? `${off}% OFF` : ""}</span>
        <button
          type="button"
          onClick={() => salvar(precoDigitado)}
          disabled={estado === "salvando" || precoDigitado === null}
          className="rounded bg-mozz-black px-3 py-1.5 text-[13px] text-white disabled:opacity-40"
        >
          {estado === "salvando" ? "Salvando..." : "Salvar"}
        </button>
        {peca.precoBlack && (
          <button type="button" onClick={() => salvar(null)} className="text-[13px] underline">
            Tirar da Black
          </button>
        )}
        {estado === "salvo" && <span className="text-[12.5px] text-green-700">Salvo</span>}
      </div>
      {estado === "erro" && <p className="w-full text-[12.5px] text-red-600">{erro}</p>}
    </div>
  );
}

export default function PainelBlackFriday({
  pecasIniciais,
  cadastros,
  linkAcesso,
  liberarEnvioEm
}: {
  pecasIniciais: PecaBlack[];
  cadastros: CadastroBlack[];
  linkAcesso: string;
  liberarEnvioEm: string;
}) {
  const [aba, setAba] = useState<"pecas" | "cadastros">("pecas");
  const [pecas, setPecas] = useState(pecasIniciais);
  const [busca, setBusca] = useState("");
  const [marca, setMarca] = useState("");
  const [soMarcadas, setSoMarcadas] = useState(false);
  const [limite, setLimite] = useState(POR_PAGINA);
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);

  const marcas = useMemo(() => Array.from(new Set(pecasIniciais.map((p) => p.marca))).sort(), [pecasIniciais]);
  const marcadas = pecas.filter((p) => p.precoBlack);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return pecas.filter(
      (p) =>
        (!termo || p.nome.toLowerCase().includes(termo)) &&
        (!marca || p.marca === marca) &&
        (!soMarcadas || p.precoBlack)
    );
  }, [pecas, busca, marca, soMarcadas]);

  function aoSalvar(id: string, preco: number | null) {
    setPecas((atual) => atual.map((p) => (p.id === id ? { ...p, precoBlack: preco } : p)));
  }

  const pendentesEmail = cadastros.filter((c) => !c.email_acesso_enviado_em).length;
  const envioLiberado = Date.now() >= Date.parse(liberarEnvioEm);
  const mensagemWhatsapp = `Oi! Aqui é da Mozz. Como você se cadastrou, a Black Friday abriu primeiro para você: até a meia-noite, só quem tem este link consegue comprar, com a grade completa. Entre aqui: ${linkAcesso}`;

  async function copiar(texto: string, confirmacao: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setAviso(confirmacao);
    } catch {
      setAviso("Não foi possível copiar automaticamente.");
    }
  }

  function baixarCsv() {
    const linhas = [
      "nome,whatsapp,email,cadastrado_em",
      ...cadastros.map((c) =>
        [c.nome, `55${c.whatsapp}`, c.email, new Date(c.criado_em).toLocaleString("pt-BR")]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      )
    ];
    const blob = new Blob([linhas.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cadastros-black-friday.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function enviarEmails() {
    setEnviando(true);
    setAviso("");
    try {
      const resposta = await fetch("/api/admin/black-friday/enviar-acesso", { method: "POST" });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(dados.erro ?? "Erro ao enviar");
      setAviso(`E-mails enviados: ${dados.enviados}. Falharam: ${dados.falhas}. Recarregue a página para ver a lista atualizada.`);
    } catch (falha) {
      setAviso(falha instanceof Error ? falha.message : "Erro ao enviar");
    } finally {
      setEnviando(false);
    }
  }

  const classeAba = (ativa: boolean) =>
    `px-4 py-2 text-[14px] border-b-2 ${ativa ? "border-mozz-black font-medium" : "border-transparent text-mozz-gray"}`;

  return (
    <div>
      <div className="mb-4 flex gap-2 border-b border-black/10">
        <button type="button" className={classeAba(aba === "pecas")} onClick={() => setAba("pecas")}>
          Peças ({marcadas.length} na Black)
        </button>
        <button type="button" className={classeAba(aba === "cadastros")} onClick={() => setAba("cadastros")}>
          Cadastros ({cadastros.length})
        </button>
      </div>

      {aviso && <p className="mb-4 rounded bg-mozz-stone px-4 py-2 text-[14px]">{aviso}</p>}

      {aba === "pecas" && (
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <input
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setLimite(POR_PAGINA);
              }}
              placeholder="Buscar peça pelo nome"
              className="min-w-[220px] flex-1 rounded border border-black/20 px-3 py-2 text-[14px]"
            />
            <select
              value={marca}
              onChange={(e) => {
                setMarca(e.target.value);
                setLimite(POR_PAGINA);
              }}
              className="rounded border border-black/20 px-3 py-2 text-[14px]"
            >
              <option value="">Todas as marcas</option>
              {marcas.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-[14px]">
              <input type="checkbox" checked={soMarcadas} onChange={(e) => setSoMarcadas(e.target.checked)} />
              Só as da Black
            </label>
          </div>
          <p className="mb-2 text-[13px] text-mozz-gray">{filtradas.length} peças</p>
          {filtradas.slice(0, limite).map((p) => (
            <LinhaPeca key={p.id} peca={p} aoSalvar={aoSalvar} />
          ))}
          {filtradas.length > limite && (
            <button type="button" onClick={() => setLimite((l) => l + POR_PAGINA)} className="mt-4 text-[14px] underline">
              Mostrar mais
            </button>
          )}
        </div>
      )}

      {aba === "cadastros" && (
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copiar(cadastros.map((c) => `55${c.whatsapp}`).join("\n"), "WhatsApps copiados.")}
              className="rounded border border-black/20 px-3 py-2 text-[14px]"
            >
              Copiar WhatsApps
            </button>
            <button
              type="button"
              onClick={() => copiar(mensagemWhatsapp, "Mensagem de acesso antecipado copiada.")}
              className="rounded border border-black/20 px-3 py-2 text-[14px]"
            >
              Copiar mensagem para o WhatsApp
            </button>
            <button type="button" onClick={baixarCsv} className="rounded border border-black/20 px-3 py-2 text-[14px]">
              Baixar planilha
            </button>
            <button
              type="button"
              onClick={enviarEmails}
              disabled={!envioLiberado || enviando || pendentesEmail === 0}
              className="rounded bg-mozz-black px-3 py-2 text-[14px] text-white disabled:opacity-40"
            >
              {enviando ? "Enviando..." : `Enviar e-mail de acesso antecipado (${pendentesEmail})`}
            </button>
          </div>
          {!envioLiberado && (
            <p className="mb-4 text-[13px] text-mozz-gray">O envio de e-mail libera em 27/11 a partir das 20h30.</p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <thead>
                <tr className="border-b border-black/10 text-[12.5px] uppercase text-mozz-gray">
                  <th className="py-2 pr-3">Nome</th>
                  <th className="py-2 pr-3">WhatsApp</th>
                  <th className="py-2 pr-3">E-mail</th>
                  <th className="py-2 pr-3">Cadastro</th>
                  <th className="py-2">E-mail enviado</th>
                </tr>
              </thead>
              <tbody>
                {cadastros.map((c) => (
                  <tr key={c.whatsapp} className="border-b border-black/5">
                    <td className="py-2 pr-3">{c.nome}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{formatarWhatsapp(c.whatsapp)}</td>
                    <td className="py-2 pr-3">{c.email}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{new Date(c.criado_em).toLocaleString("pt-BR")}</td>
                    <td className="py-2">{c.email_acesso_enviado_em ? "Sim" : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cadastros.length === 0 && <p className="py-6 text-mozz-gray">Ninguém se cadastrou ainda.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
