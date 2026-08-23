import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { CartProvider } from "@/lib/cart-context";

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
    <html lang="pt-BR">
      <head>
        {/* Fontes via <link> pro Google Fonts, carregadas pelo NAVEGADOR de quem visita o
            site - em vez de next/font/google, que baixa a fonte durante o BUILD na Vercel e
            quebrou o deploy quando essa etapa falhou (erro "Failed to collect page data for
            /_not-found" em 23/08/2026). Esse jeito classico nao depende de rede no momento
            de publicar, so' no momento de visitar o site (bem mais confiavel). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap"
        />
      </head>
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
