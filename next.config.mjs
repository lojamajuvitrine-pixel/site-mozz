/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.mitiendanube.com" },
      { protocol: "https", hostname: "**.bling.com.br" }
    ]
  },
  async redirects() {
    return [
      {
        source: '/masculino1',
        destination: '/produtos',
        permanent: true,
      },
    ];
  }
};

export default nextConfig;
