"use client";

// Formulario de dados do cliente (nome, CPF, telefone, endereco) - guardado direto no
// user_metadata do proprio usuario no Supabase Auth (nao precisa de tabela nova no banco:
// e' pouca informacao, ligada 1-pra-1 com a conta, e o Supabase ja guarda isso pra gente).
// Serve pra: nota fiscal do pedido (CPF/nome), contato sobre entrega (telefone) e agilizar
// checkout futuro (endereco ja preenchido). Nenhum campo aqui e' obrigatorio pra ter conta -
// o cliente pode logar e nunca preencher isso, mas fica pedido de forma clara.
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatarCPF, validarCPF, formatarTelefone, formatarCEP, apenasDigitos } from "@/lib/validacao";
import { buscarEnderecoPorCep } from "@/lib/cep";

export type DadosPerfil = {
  nomeCompleto: string;
  cpf: string;
  telefone: string;
  dataNascimento: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
};

const PERFIL_VAZIO: DadosPerfil = {
  nomeCompleto: "",
  cpf: "",
  telefone: "",
  dataNascimento: "",
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: ""
};

export default function PerfilForm({ perfilInicial }: { perfilInicial: Partial<DadosPerfil> }) {
  const [dados, setDados] = useState<DadosPerfil>({ ...PERFIL_VAZIO, ...perfilInicial });
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  function atualizar<K extends keyof DadosPerfil>(campo: K, valor: DadosPerfil[K]) {
    setDados((atual) => ({ ...atual, [campo]: valor }));
    setSalvo(false);
  }

  async function aoSairDoCep() {
    if (apenasDigitos(dados.cep).length !== 8) return;
    setBuscandoCep(true);
    const endereco = await buscarEnderecoPorCep(dados.cep);
    if (endereco) {
      setDados((atual) => ({
        ...atual,
        endereco: endereco.rua || atual.endereco,
        bairro: endereco.bairro || atual.bairro,
        cidade: endereco.cidade || atual.cidade,
        uf: endereco.uf || atual.uf
      }));
    }
    setBuscandoCep(false);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (dados.cpf && !validarCPF(dados.cpf)) {
      setErro("CPF inválido - confere os números digitados.");
      return;
    }

    setSalvando(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: {
          nome_completo: dados.nomeCompleto,
          cpf: dados.cpf,
          telefone: dados.telefone,
          data_nascimento: dados.dataNascimento,
          cep: dados.cep,
          endereco: dados.endereco,
          numero: dados.numero,
          complemento: dados.complemento,
          bairro: dados.bairro,
          cidade: dados.cidade,
          uf: dados.uf
        }
      });
      if (error) throw error;
      setSalvo(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar. Tenta de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4">
      <div>
        <p className="text-[13px] text-mozz-gray mb-1">Nome completo</p>
        <input
          value={dados.nomeCompleto}
          onChange={(e) => atualizar("nomeCompleto", e.target.value)}
          placeholder="Seu nome completo"
          className="w-full border border-black/20 px-3 py-2.5 text-[14.5px] focus:outline-none focus:border-mozz-black"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[13px] text-mozz-gray mb-1">CPF</p>
          <input
            value={dados.cpf}
            onChange={(e) => atualizar("cpf", formatarCPF(e.target.value))}
            placeholder="000.000.000-00"
            inputMode="numeric"
            className="w-full border border-black/20 px-3 py-2.5 text-[14.5px] focus:outline-none focus:border-mozz-black"
          />
        </div>
        <div>
          <p className="text-[13px] text-mozz-gray mb-1">Telefone / WhatsApp</p>
          <input
            value={dados.telefone}
            onChange={(e) => atualizar("telefone", formatarTelefone(e.target.value))}
            placeholder="(00) 00000-0000"
            inputMode="numeric"
            className="w-full border border-black/20 px-3 py-2.5 text-[14.5px] focus:outline-none focus:border-mozz-black"
          />
        </div>
      </div>

      <div>
        <p className="text-[13px] text-mozz-gray mb-1">Data de nascimento (opcional)</p>
        <input
          type="date"
          value={dados.dataNascimento}
          onChange={(e) => atualizar("dataNascimento", e.target.value)}
          className="w-full sm:w-48 border border-black/20 px-3 py-2.5 text-[14.5px] focus:outline-none focus:border-mozz-black"
        />
      </div>

      <div className="pt-2 border-t border-black/10">
        <p className="text-[14.5px] mt-4 mb-3">Endereço de entrega</p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="text-[13px] text-mozz-gray mb-1">CEP</p>
            <input
              value={dados.cep}
              onChange={(e) => atualizar("cep", formatarCEP(e.target.value))}
              onBlur={aoSairDoCep}
              placeholder="00000-000"
              inputMode="numeric"
              className="w-full border border-black/20 px-3 py-2.5 text-[14.5px] focus:outline-none focus:border-mozz-black"
            />
            {buscandoCep && <p className="text-[12.5px] text-mozz-gray mt-1">Buscando endereço...</p>}
          </div>
          <div>
            <p className="text-[13px] text-mozz-gray mb-1">Número</p>
            <input
              value={dados.numero}
              onChange={(e) => atualizar("numero", e.target.value)}
              className="w-full border border-black/20 px-3 py-2.5 text-[14.5px] focus:outline-none focus:border-mozz-black"
            />
          </div>
        </div>

        <div className="mb-3">
          <p className="text-[13px] text-mozz-gray mb-1">Rua</p>
          <input
            value={dados.endereco}
            onChange={(e) => atualizar("endereco", e.target.value)}
            className="w-full border border-black/20 px-3 py-2.5 text-[14.5px] focus:outline-none focus:border-mozz-black"
          />
        </div>

        <div className="mb-3">
          <p className="text-[13px] text-mozz-gray mb-1">Complemento (opcional)</p>
          <input
            value={dados.complemento}
            onChange={(e) => atualizar("complemento", e.target.value)}
            placeholder="Apto, bloco, referência..."
            className="w-full border border-black/20 px-3 py-2.5 text-[14.5px] focus:outline-none focus:border-mozz-black"
          />
        </div>

        <div className="grid grid-cols-[1fr_1fr_80px] gap-3">
          <div>
            <p className="text-[13px] text-mozz-gray mb-1">Bairro</p>
            <input
              value={dados.bairro}
              onChange={(e) => atualizar("bairro", e.target.value)}
              className="w-full border border-black/20 px-3 py-2.5 text-[14.5px] focus:outline-none focus:border-mozz-black"
            />
          </div>
          <div>
            <p className="text-[13px] text-mozz-gray mb-1">Cidade</p>
            <input
              value={dados.cidade}
              onChange={(e) => atualizar("cidade", e.target.value)}
              className="w-full border border-black/20 px-3 py-2.5 text-[14.5px] focus:outline-none focus:border-mozz-black"
            />
          </div>
          <div>
            <p className="text-[13px] text-mozz-gray mb-1">UF</p>
            <input
              value={dados.uf}
              onChange={(e) => atualizar("uf", e.target.value.toUpperCase().slice(0, 2))}
              maxLength={2}
              className="w-full border border-black/20 px-3 py-2.5 text-[14.5px] focus:outline-none focus:border-mozz-black uppercase"
            />
          </div>
        </div>
      </div>

      {erro && <p className="text-[13.5px] text-red-600">{erro}</p>}
      {salvo && <p className="text-[13.5px] text-green-700">Dados salvos.</p>}

      <button
        type="submit"
        disabled={salvando}
        className="text-[14.5px] py-3 bg-mozz-black text-white disabled:opacity-60 mt-2"
      >
        {salvando ? "Salvando..." : "Salvar dados"}
      </button>
    </form>
  );
}
