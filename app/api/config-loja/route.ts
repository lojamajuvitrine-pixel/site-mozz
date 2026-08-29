import { NextResponse } from "next/server";
import { buscarConfiguracaoLoja } from "@/lib/configLoja";

export const dynamic = "force-dynamic";

export async function GET() {
  const configuracao = await buscarConfiguracaoLoja();
  return NextResponse.json(configuracao);
}
