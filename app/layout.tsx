import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { CartProvider } from "@/lib/cart-context";

// Fontes de verdade via next/font - antes eram so' referenciadas no globals.css (variavel
// --font-serif/--font-sans) mas o arquivo da fonte nunca era baixado, entao o navegador
// sempre caia no fallback (Georgia/Helvetica) mesmo o CSS "pedindo" Playfair Display. Usar
// next/font tambem otimiza o carregamento (self-hosted automaticamente, sem flash de fonte
// errada) em vez de depender de um <link> pro Google Fonts.
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Playfair_Display({ subsets: ["latin"], variable: "--font-serif", display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://site-mozz.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "MOZZ — Animale, NV, Reserva e Foxton em um só lugar",
    template: "%s | MOZZ"
  },
  description:
    "Loja multimarcas com peças da Animale, NV, Reserva e Foxton. Frete para todo o Brasil, troca fácil e parcelamento sem juros.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "MOZZ",
    title: "MOZZ — Animale, NV, Reserva e Foxton em um só lugar",
    description: "Loja multimarcas com peças da Animale, NV, Reserva e Foxton."
  },
  robots: { index: true, follow: true }
};

// IDs de rastreamento (Meta Pixel / Google Analytics) - so' carrega o script quando a
// variavel de ambiente correspondente estiver preenchida, pra nunca quebrar o site antes
// desses cadastros existirem (ver PROXIMOS_PASSOS.md pra como obter cada ID).
const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const googleAnalyticsId = process.env.NEXT_PUBLIC_GA_ID;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${serif.variable}`}>
      <body className="font-sans">
        {metaPixelId && (
          <Script id="meta-pixel" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${metaPixelId}');
              fbq('track', 'PageView');
            `}
          </Script>
        )}
        {googleAnalyticsId && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`} strategy="afterInteractive" />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${googleAnalyticsId}');
              `}
            </Script>
          </>
        )}

        <CartProvider>
          <Nav />
          <main className="max-w-6xl mx-auto px-6">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
