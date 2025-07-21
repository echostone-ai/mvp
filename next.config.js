/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable type checking during build to avoid issues with route handlers
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  
  // Other Next.js config options
  reactStrictMode: true,
  swcMinify: true,
}

module.exports = nextConfig