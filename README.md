# ⬇ VidSnap — Video Downloader

A modern, fast, and secure video downloader supporting YouTube, Instagram, Twitter/X, Facebook, TikTok, Vimeo, and more.

---

## 🗂 Project Structure

```
vidsnap/
├── frontend/
│   ├── index.html       — Main UI (single-page app)
│   ├── manifest.json    — PWA manifest
│   └── sw.js            — Service worker (offline support)
│
├── backend/
│   ├── server.js        — Express server entry point
│   ├── package.json     — Node.js dependencies
│   ├── routes/
│   │   ├── info.js      — POST /api/info  (fetch video metadata)
│   │   └── download.js  — GET  /api/download (stream video/audio)
│   ├── middleware/
│   │   └── errorHandler.js — Global error handler
│   └── utils/
│       ├── urlValidator.js  — URL validation & platform detection
│       └── formatParser.js  — Parse yt-dlp format data
│
├── README.md
└── .env.example
```

---

## 🔧 Prerequisites

Before you start, install these tools:

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | https://nodejs.org |
| npm | 9+ | Included with Node |
| yt-dlp | Latest | `pip install yt-dlp` |
| ffmpeg | 6+ | `apt install ffmpeg` or https://ffmpeg.org |

> **What is yt-dlp?** It's a command-line program that downloads videos from YouTube and 1,000+ other sites. Our backend calls it as a subprocess. You must install it on the server.

---

## 🚀 Quick Start (Local Development)

### 1. Clone and install dependencies

```bash
git clone https://github.com/yourname/vidsnap.git
cd vidsnap/backend
npm install
```

### 2. Create environment file

```bash
cp .env.example .env
```

Edit `.env`:
```
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5500
```

### 3. Start the backend

```bash
npm run dev        # development (auto-restarts on changes)
# or
npm start          # production
```

The API will be running at: `http://localhost:3001`

### 4. Open the frontend

Option A — Use Live Server (VS Code extension) on `frontend/index.html`  
Option B — Serve with Node:
```bash
npx serve frontend -p 3000
```

### 5. Update the API_BASE in frontend

Open `frontend/index.html` and find line:
```js
const API_BASE = 'http://localhost:3001/api';
```
Change to your production domain for deployment.

---

## 📡 API Reference

### POST `/api/info`

Fetch video metadata.

**Request:**
```json
{ "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }
```

**Response:**
```json
{
  "success":   true,
  "platform":  { "name": "YouTube", "slug": "youtube", "color": "#ff0000" },
  "title":     "Never Gonna Give You Up",
  "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  "duration":  213,
  "uploader":  "Rick Astley",
  "formats": [
    { "format_id": "137", "quality": "1080p", "filesize": "42 MB", "ext": "mp4" },
    { "format_id": "136", "quality": "720p",  "filesize": "22 MB", "ext": "mp4" }
  ]
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "This video is private and cannot be downloaded."
}
```

---

### GET `/api/download`

Download video or audio. Streams the file directly.

**Query Parameters:**
| Param | Required | Example | Description |
|-------|----------|---------|-------------|
| url | Yes | `https://youtube.com/watch?v=...` | Video URL |
| format | No | `720p`, `1080p`, `best` | Quality (default: best) |
| type | No | `video`, `audio` | Download type (default: video) |

**Example:**
```
GET /api/download?url=https://youtube.com/watch?v=...&format=720p&type=video
```

Returns binary file stream with appropriate Content-Type and Content-Disposition headers.

---

## 🌐 Deployment

### Option 1: Vercel (Frontend only)

```bash
npm install -g vercel
cd frontend
vercel deploy
```

Note: Vercel is serverless — the Node.js backend needs to be deployed separately or rewritten as Vercel API routes.

---

### Option 2: Render.com (Full stack — Recommended for beginners)

1. Push code to GitHub
2. Go to https://render.com → New → Web Service
3. Connect your repo, set:
   - Build command: `cd backend && npm install`
   - Start command: `node backend/server.js`
   - Add environment variable: `NODE_ENV=production`
4. Add a buildpack for yt-dlp and ffmpeg

---

### Option 3: VPS (Ubuntu/Debian — Full control)

```bash
# Install dependencies
sudo apt update
sudo apt install nodejs npm ffmpeg python3-pip -y
pip install yt-dlp

# Upload project
git clone your-repo /var/www/vidsnap
cd /var/www/vidsnap/backend
npm install

# Install PM2 (keeps the server running)
npm install -g pm2
pm2 start server.js --name vidsnap
pm2 save
pm2 startup

# Nginx config (reverse proxy)
# /etc/nginx/sites-available/vidsnap:
#   server {
#     server_name yourdomain.com;
#     location /api { proxy_pass http://localhost:3001; }
#     location / { root /var/www/vidsnap/frontend; try_files $uri /index.html; }
#   }

sudo certbot --nginx -d yourdomain.com  # SSL certificate
```

---

## 🔒 Security Notes

- **No videos are stored** — yt-dlp streams directly through the server
- **SSRF protection** — internal IPs are blocked in the URL validator
- **Rate limiting** — 30 info requests / 5 downloads per 15 minutes per IP
- **Input sanitization** — all filenames are sanitized before use
- **CORS** — only whitelisted origins can access the API
- **Helmet.js** — sets secure HTTP headers automatically

---

## ⚠️ Legal Notice

This tool is for **personal use only**. Users must comply with:
- Platform Terms of Service (YouTube, Instagram, etc.)
- Copyright law in their jurisdiction
- The DMCA and equivalent laws

Do not use this to redistribute or monetize copyrighted content.

---

## 💡 Extending the Platform

To add a new platform:

1. Add its regex to `backend/utils/urlValidator.js`
2. Test with `yt-dlp --dump-json "https://newplatform.com/video/..."` to verify yt-dlp supports it
3. Add its chip to the frontend `platform-chips` section

---

## 📄 License

MIT — free to use, modify, and distribute with attribution.
