const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    turbo: {
      root: path.resolve(__dirname),
    },
  },
}

module.exports = nextConfig
