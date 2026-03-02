# LoopArchitect Frontend - Quick Start Guide

## Prerequisites Installation

### Install Node.js (Required)

1. **Download Node.js:**
   - Visit: https://nodejs.org/
   - Download the **LTS version** (Currently 20.x or higher)
   - Run the installer and follow the prompts

2. **Verify Installation:**
   ```powershell
   node --version
   npm --version
   ```

## Project Setup

### Step 1: Install Dependencies

Open PowerShell in the project directory and run:

```powershell
# Option 1: Run the setup script
.\setup.ps1

# Option 2: Manual installation
npm install
```

### Step 2: Start Development Server

```powershell
# Option 1: Use the start script
.\start-dev.ps1

# Option 2: Manual start
npm run dev
```

### Step 3: Open in Browser

The application will be available at:
**http://localhost:3000**

Your browser should automatically open. If not, manually navigate to the URL above.

## Quick Commands Reference

```powershell
# Install dependencies
npm install

# Start development server (with hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Testing the Application

1. Click the **"Preview Instrumental"** button
2. The app will fetch audio from the backend API
3. An audio player will appear with autoplay enabled
4. Use the player controls to play/pause/seek

## Project Structure

```
looparchitect-frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx       # Root layout with metadata
│   │   ├── page.tsx         # Homepage with preview functionality
│   │   └── globals.css      # Global styles and Tailwind
│   ├── components/
│   │   ├── AudioPlayer.tsx  # Styled audio player component
│   │   ├── Button.tsx       # Reusable button component
│   │   └── Header.tsx       # Navigation header
│   └── lib/
│       └── api.ts           # API client for backend
├── .env.local              # Environment configuration
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── tailwind.config.js      # TailwindCSS configuration
└── README.md               # Full documentation
```

## Environment Configuration

The `.env.local` file contains:
```env
NEXT_PUBLIC_API_URL=https://looparchitect-backend-api.onrender.com
```

This can be changed to point to a different backend if needed.

## Troubleshooting

### Port 3000 is already in use
```powershell
# Use a different port
$env:PORT=3001; npm run dev
```

### Dependencies fail to install
```powershell
# Clear npm cache and retry
npm cache clean --force
npm install
```

### TypeScript errors
```powershell
# Rebuild TypeScript definitions
npm run build
```

## Features

✅ Modern dark theme optimized for music production
✅ Responsive design (mobile, tablet, desktop)
✅ Real-time audio preview from backend API
✅ Loading states and error handling
✅ TypeScript for type safety
✅ TailwindCSS for styling
✅ Production-ready code structure

## Support

For issues or questions, refer to:
- Backend API: https://looparchitect-backend-api.onrender.com
- Next.js Documentation: https://nextjs.org/docs
- TailwindCSS Documentation: https://tailwindcss.com/docs
