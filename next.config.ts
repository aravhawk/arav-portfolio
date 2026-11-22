import type { NextConfig } from 'next';
import { REDIRECT_HOSTS, SITE_URL } from './src/lib/site';

/* arav.pro is the canonical host. These are a backup for the registrar
   redirect: any request that reaches this deployment on an old or www host
   is sent to the same path on arav.pro with a permanent (308) redirect.
   The address and the hosts live in src/lib/site.ts and nowhere else. */

const nextConfig: NextConfig = {
  transpilePackages: ['next-mdx-remote'],
  agentRules: false,
  /* Pictures are served as AVIF where the browser takes it, WebP otherwise. The scenes' stills ask for the higher
     quality (still-pictures.tsx): at the default their snow and ice lose their grain. */
  images: { formats: ['image/avif', 'image/webp'], qualities: [75, 90] },
  async redirects() {
    return [
      ...REDIRECT_HOSTS.map((host) => ({
        source: '/:path*',
        has: [{ type: 'host' as const, value: host }],
        destination: `${SITE_URL}/:path*`,
        permanent: true,
      })),
      // The flight was built at this address before it became the home page.
      { source: '/flight', destination: '/', permanent: true },
    ];
  },
};

export default nextConfig;
