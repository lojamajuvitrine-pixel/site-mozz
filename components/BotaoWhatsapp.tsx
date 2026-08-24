// Botao flutuante de WhatsApp - fixo no canto da tela em toda pagina do site, pro cliente
// tirar duvida direto com a loja sem precisar procurar contato em outro lugar. Numero fixo da
// MOZZ (informado pelo Brunno em 24/08/2026) - se um dia trocar, e' so' mudar aqui.
const NUMERO_WHATSAPP = "5542988351888";
const MENSAGEM_PADRAO = "Olá! Vim do site da MOZZ e tenho uma dúvida.";

function IconeWhatsapp() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.39 1.26 4.81L2 22l5.42-1.42a9.9 9.9 0 0 0 4.62 1.15h.01c5.46 0 9.9-4.45 9.9-9.91C21.95 6.45 17.5 2 12.04 2zm5.8 14.03c-.24.68-1.4 1.3-1.94 1.38-.5.08-1.12.11-1.8-.11-.42-.13-.95-.31-1.64-.6-2.88-1.24-4.76-4.14-4.9-4.33-.14-.19-1.17-1.56-1.17-2.97 0-1.41.74-2.1 1-2.39.26-.29.58-.36.77-.36.19 0 .39 0 .55.01.18.01.42-.07.65.5.24.58.81 2 .88 2.14.07.14.12.31.02.5-.1.19-.15.31-.29.48-.14.17-.3.37-.43.5-.14.14-.29.29-.13.57.17.29.75 1.24 1.6 2.01 1.1 1 2.03 1.31 2.32 1.46.29.14.46.12.63-.07.17-.19.72-.84.92-1.13.19-.29.38-.24.64-.14.26.1 1.65.78 1.93.92.29.14.48.22.55.34.07.12.07.68-.17 1.36z" />
    </svg>
  );
}

export default function BotaoWhatsapp() {
  const link = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(MENSAGEM_PADRAO)}`;

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
    >
      <IconeWhatsapp />
    </a>
  );
}
