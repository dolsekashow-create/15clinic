import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Standalone output is ONLY for the Docker image. Vercel builds its own
  // bundle, and forcing standalone there changes the output layout and breaks
  // the deployment.
  ...(process.env.BUILD_TARGET === 'docker'
    ? { output: 'standalone' as const, outputFileTracingRoot: path.join(import.meta.dirname, '../../') }
    : {}),
  transpilePackages: ['@clinic/core', '@clinic/data', '@clinic/auth', '@clinic/infra', '@clinic/services'],
  // Security headers. CSP is deliberately strict; add hosts here rather than
  // loosening it with a wildcard.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https://firebasestorage.googleapis.com",
              "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default config;
