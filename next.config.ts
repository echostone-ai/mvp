// next.config.ts
import { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    // ignore all ESLint errors during production builds
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
