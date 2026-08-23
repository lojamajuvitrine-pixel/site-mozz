/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.mitiendanube.com" },
      { protocol: "https", hostname: "**.bling.com.br" },
      { protocol: "https", hostname: "**.s3.amazonaws.com" }
    ]
  }
};
export default nextConfig;
