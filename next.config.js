const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.BACKEND_ORIGIN ? `${process.env.BACKEND_ORIGIN}/api/:path*` : 'http://localhost:8000/api/:path*',
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
