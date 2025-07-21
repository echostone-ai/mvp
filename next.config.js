/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable type checking during build
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Disable ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Other Next.js config options
  reactStrictMode: true,
}

module.exports = nextConfig
