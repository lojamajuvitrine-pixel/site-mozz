import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { CartProvider } from "@/lib/cart-context";

export const metadata: Metadata = {
  title: "MOZZ",
  description: "Animale, NV, Reserva e Foxton em um so lugar."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-sans">
        <CartProvider>
          <Nav />
          <main className="max-w-6xl mx-auto px-6">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
