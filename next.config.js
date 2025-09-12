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
  
  // Configuration for Vercel deployment
  images: {
    unoptimized: true,
  },
  
  // Other Next.js config options
  reactStrictMode: true,
}

module.exports = nextConfig
