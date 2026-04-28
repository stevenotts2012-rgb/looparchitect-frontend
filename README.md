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

# Stable startup (cleans stale local Next.js processes, uses port 3001)
npm run dev:stable
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Local Development Setup

Backend features depend on FFmpeg and Redis. Use the helper script to check both before starting services.

### Install FFmpeg (Windows)

```bash
winget install --id Gyan.FFmpeg -e
```

### Install Redis (Windows options)

```bash
# Docker option (recommended)
docker run --name looparchitect-redis -p 6379:6379 -d redis:7
```

Alternative options:
- Memurai (Redis-compatible for Windows)
- WSL2 + `redis-server`

### Run dependency checks

```bash
npm run dev:services
```

This runs `scripts/dev_setup.ps1` from the backend and prints:
- FFmpeg detected/missing
- Redis installed/running status
- Install instructions when dependencies are missing

Development mode can still run when Redis is not running (non-queue routes remain available).

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
NEXT_PUBLIC_API_URL=https://web-production-3afc5.up.railway.app
```

## API Integration

The app connects to the FastAPI backend via `NEXT_PUBLIC_API_URL`, for example `https://web-production-3afc5.up.railway.app/api/v1/loops/19/play`.

## Available Scripts

- `npm run dev` - Start development server
- `npm run dev:services` - Check local FFmpeg/Redis dependencies and show setup guidance
- `npm run dev:stable` - Start development server with automatic local port/process cleanup
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## License

Proprietary - All Rights Reserved

<!-- redeploy trigger: 2026-04-28 22:42:26 +00:00 -->
