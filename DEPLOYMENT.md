# GitHub Pages Deployment Guide

## Setup Instructions

1. **Repository Settings**
   - Go to your GitHub repository settings
   - Navigate to "Pages" section
   - Set source to "GitHub Actions"

2. **Environment Variables**
   Add these secrets in your GitHub repository settings (Settings > Secrets and variables > Actions):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `HEYGEN_API_KEY`

3. **Deploy**
   - Push to the `main` branch
   - GitHub Actions will automatically build and deploy your site
   - Your site will be available at: `https://[username].github.io/[repository-name]`

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Test static export locally
npm run export
```

## Notes

- The site is configured for static export, making it compatible with GitHub Pages
- Images are set to unoptimized for static hosting
- All API keys are now properly secured using environment variables