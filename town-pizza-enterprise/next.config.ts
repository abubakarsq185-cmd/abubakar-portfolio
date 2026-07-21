import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // three.js ships untranspiled ESM helpers; let Next transpile them.
  transpilePackages: ["three"],
};

export default nextConfig;
