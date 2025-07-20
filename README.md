# Legacy Hub Feature

This project implements the Legacy Hub feature for EchoStone, allowing users to create and share memory collections with friends and family.

## Features

- Create and manage Legacy Hubs
- Add memories (text, images, audio)
- Invite others to view and contribute
- Flag inappropriate content
- Moderate content as a hub owner
- Secure invitation system
- Notification system

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/echostones-legacy-hub.git
cd echostones-legacy-hub
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Set up environment variables:
```
# Create a .env file with the following variables
DATABASE_URL="postgresql://username:password@localhost:5432/echostones"
NEXTAUTH_SECRET="your-secret-key"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

4. Run database migrations:
```bash
npx prisma migrate dev
```

5. Start the development server:
```bash
npm run dev
# or
yarn dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Documentation

For detailed usage instructions, see [LEGACY_HUB_USAGE.md](LEGACY_HUB_USAGE.md).

## Project Structure

- `/prisma` - Database schema and migrations
- `/src/app` - Next.js app router pages
- `/src/app/api` - API routes
- `/src/components` - React components
- `/src/lib` - Utility functions and services

## API Endpoints

See [LEGACY_HUB_USAGE.md](LEGACY_HUB_USAGE.md) for a complete list of API endpoints.

## License

This project is licensed under the MIT License - see the LICENSE file for details.