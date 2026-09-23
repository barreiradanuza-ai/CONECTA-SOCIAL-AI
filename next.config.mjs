/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pacotes nativos / pesados ficam fora do bundle do servidor.
  serverExternalPackages: ["sharp", "@resvg/resvg-js", "satori", "@prisma/client", "@aws-sdk/client-s3"],
  experimental: {
    serverActions: { bodySizeLimit: "60mb" },
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
