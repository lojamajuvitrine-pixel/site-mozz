import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import BotaoWhatsapp from "@/components/BotaoWhatsapp";
import { CartProvider } from "@/lib/cart-context";
import { FavoritosProvider } from "@/lib/favoritos-context";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
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
  robots: { index: true, follow: true },
  verification: {
    google: "A69GTCztgZTHdFELF65m0LHVAFPLN3slT-6u5koLaeA",
    other: {
      "msvalidate.01": "049633D0464FBABF78460A7D6239ED4C",
    },
  }
};

const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const googleAnalyticsId = process.env.NEXT_PUBLIC_GA_ID;
const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap"
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "ClothingStore", name: "MOZZ", url: SITE_URL, telephone: "+5542988351888", address: { "@type": "PostalAddress", streetAddress: "Avenida Coronel Rogério Borba, 480", addressLocality: "Reserva", addressRegion: "PR", postalCode: "84320-000", addressCountry: "BR" }, openingHoursSpecification: [{ "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday"], opens: "09:00", closes: "18:00" }, { "@type": "OpeningHoursSpecification", dayOfWeek: ["Saturday"], opens: "09:00", closes: "12:00" }] }) }} />
        {/* WebSite + SearchAction: habilita a caixa de busca do site direto no resultado do
            Google (sitelinks search box). O template aponta pra busca de verdade do catalogo -
            /produtos?busca=termo ja funciona (GradeProdutos usa isso como valor inicial do
            campo), nao e' so' decorativo. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "MOZZ",
              url: SITE_URL,
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: `${SITE_URL}/produtos?busca={search_term_string}`
                },
                "query-input": "required name=search_term_string"
              }
            })
          }}
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
        {clarityId && (
          <Script id="microsoft-clarity" strategy="afterInteractive">
            {`
              (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "${clarityId}");
            `}
          </Script>
        )}

        <CartProvider>
          <FavoritosProvider>
            <Nav />
            <main className="max-w-6xl mx-auto px-6">{children}</main>
            <Footer />
            <BotaoWhatsapp />
          </FavoritosProvider>
        </CartProvider>
      </body>
    </html>
  );
}
