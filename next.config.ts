import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['next-mdx-remote'],
  agentRules: false,
  async rewrites() {
    return [{ source: '/favicon.ico', destination: '/icon.svg' }];
  },
};

export default nextConfig;
