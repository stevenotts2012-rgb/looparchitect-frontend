# LoopArchitect Frontend

A modern, production-ready Next.js 14 frontend for the LoopArchitect music platform.

## Features

- 🎵 Preview high-quality instrumentals
- ⚡ Built with Next.js 14 App Router
- 🎨 Modern dark UI with TailwindCSS
- 📱 Fully responsive design
- 🔒 TypeScript for type safety
- 🎧 HTML5 audio player with autoplay

## Tech Stack

- **Framework:** Next.js 14
- **Language:** TypeScript
- **Styling:** TailwindCSS
- **Backend API:** FastAPI (https://looparchitect-backend-api.onrender.com)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
# Create optimized production build
npm run build

# Start production server
npm start
```

## Project Structure

```
looparchitect-frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx       # Root layout
│   │   ├── page.tsx         # Homepage
│   │   └── globals.css      # Global styles
│   ├── components/
│   │   ├── AudioPlayer.tsx  # Audio player component
│   │   ├── Button.tsx       # Reusable button
│   │   └── Header.tsx       # Navigation header
│   └── lib/
│       └── api.ts           # API helper functions
├── public/                  # Static assets
├── .env.local              # Environment variables
└── package.json            # Dependencies
```

## Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_API_URL=https://looparchitect-backend-api.onrender.com
```

## API Integration

The app connects to the FastAPI backend at `/api/v1/loops/19/play` to fetch instrumental previews.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## License

Proprietary - All Rights Reserved
