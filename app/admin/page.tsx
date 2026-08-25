import { redirect } from "next/navigation";

// /admin sozinho nao tem painel proprio - so' existe /admin/produtos por enquanto. Esse
// redirecionamento evita o 404 de quem acessa so' "/admin" (o middleware.ts ja cuida da
// checagem de login/e-mail admin antes de chegar aqui e antes de chegar em /admin/produtos).
export default function PaginaAdmin() {
  redirect("/admin/produtos");
}
