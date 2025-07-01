import { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // ← add this block
  eslint: {
    // WARNING: this will ignore *all* ESLint errors during `next build`
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
