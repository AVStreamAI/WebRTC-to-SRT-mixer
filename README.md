# SRT Streaming Application

## Prerequisites

1. Install Node.js LTS from https://nodejs.org/
2. Install FFmpeg from https://ffmpeg.org/download.html#build-windows
   - Add FFmpeg to your system PATH
3. Install Visual Studio Code (recommended)

## Setup Instructions

1. Open Command Prompt as Administrator
2. Navigate to your project folder:
   ```bash
   cd "path\to\your\project"
   ```

3. Run the setup command:
   ```bash
   npm run setup
   ```

4. Start the application:
   ```bash
   npm run dev
   ```

The application will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:8080

## Testing SRT Output

1. Install VLC media player
2. In VLC, go to Media > Open Network Stream
3. Enter the SRT URL: srt://localhost:9000

## Troubleshooting

1. If you see "'node' is not recognized":
   - Make sure Node.js is installed
   - Restart your terminal/VS Code
   - If still not working, add Node.js to your PATH manually

2. If you see "Cannot find package 'express'":
   - Run `cd backend && npm install`
   - Then try `npm run dev` again

3. Make sure FFmpeg is properly installed and in your PATH
4. Check that ports 5173 and 8080 are not in use
5. Allow camera access when prompted by the browser