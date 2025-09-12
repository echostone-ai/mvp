# Vercel Deployment Guide

## Setup Instructions

1. **Vercel Dashboard**
   - Connect your GitHub repository to Vercel
   - Import your project from GitHub
   - Vercel will automatically detect it's a Next.js project

2. **Environment Variables**
   Add these environment variables in your Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `HEYGEN_API_KEY`

3. **Deploy**
   - Push to the `main` branch
   - Vercel will automatically build and deploy your site
   - Your site will be available at your custom Vercel URL

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server locally
npm run start
```

## Vercel CLI (Optional)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from command line
vercel

# Deploy to production
vercel --prod
```

## Notes

- The site is configured for full-stack deployment with API routes
- Images are set to unoptimized for better compatibility
- All API keys are properly secured using environment variables
- GitHub Actions will run tests on pull requests