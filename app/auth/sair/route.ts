import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Logout - precisa ser uma rota de servidor (nao um clique direto no cliente) pra conseguir
// apagar o cookie httpOnly da sessao direito. Chamado pelo formulario em app/conta/page.tsx.
export async function POST(request: NextRequest) {
  const supabase = createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url));
}
