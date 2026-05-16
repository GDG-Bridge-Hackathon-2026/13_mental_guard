/** @type {import('next').NextConfig} */
const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL || "http://34.170.117.171:4000";

// distDir override is a Windows local workaround for .next file locks.
// On Vercel (process.env.VERCEL is set), we want the standard .next so the
// platform's Next.js preset finds the build output.
const isVercel = !!process.env.VERCEL;

const nextConfig = {
  reactStrictMode: true,
  ...(isVercel ? {} : { distDir: ".next-dev" }),
  webpack: (config) => {
    config.cache = false;
    return config;
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${BACKEND_URL}/health`,
      },
    ];
  },
};

module.exports = nextConfig;
