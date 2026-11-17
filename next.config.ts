import type { NextConfig } from 'next';

/* arav.pro is the canonical host. These are a backup for the registrar
   redirect: any request that reaches this deployment on an old or www host
   is sent to the same path on arav.pro with a permanent (308) redirect.
   Keep the list in step with REDIRECT_HOSTS in src/lib/site.ts. */
const CANONICAL = 'https://arav.pro';
const REDIRECT_HOSTS = ['aravjain.dev', 'www.aravjain.dev', 'www.arav.pro'];

const nextConfig: NextConfig = {
  transpilePackages: ['next-mdx-remote'],
  agentRules: false,
  async redirects() {
    return [
      ...REDIRECT_HOSTS.map((host) => ({
        source: '/:path*',
        has: [{ type: 'host' as const, value: host }],
        destination: `${CANONICAL}/:path*`,
        permanent: true,
      })),
      // The flight was built at this address before it became the home page.
      { source: '/flight', destination: '/', permanent: true },
    ];
  },
};

export default nextConfig;
