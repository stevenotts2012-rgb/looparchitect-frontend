const path = require('path')
const DEFAULT_BACKEND_ORIGIN = 'https://web-production-3afc5.up.railway.app'

function resolveBackendOrigin() {
  const configured = (process.env.BACKEND_ORIGIN || process.env.NEXT_PUBLIC_API_URL || '').trim()
  if (configured.startsWith('http://') || configured.startsWith('https://')) {
    return configured.replace(/\/$/, '')
  }

  if (process.env.NODE_ENV === 'production') {
    return DEFAULT_BACKEND_ORIGIN
  }

  return 'http://localhost:8000'
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const backendOrigin = resolveBackendOrigin()
    return [
      {
        source: '/api/:path*',
        destination: `${backendOrigin}/api/:path*`,
      },
    ]
  },
  experimental: {
    turbo: {
      root: path.resolve(__dirname),
    },
  },
}

module.exports = nextConfig
