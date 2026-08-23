/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.mitiendanube.com" },
      { protocol: "https", hostname: "**.bling.com.br" }
    ]
  }
};
export default nextConfig;
