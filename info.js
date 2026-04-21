/**
 * /api/info — Fetch Video Metadata
 * ----------------------------------
 * Accepts: POST { url: "https://..." }
 * Returns: JSON with title, thumbnail, duration,
 *          uploader, available formats, etc.
 *
 * VOCABULARY:
 *   yt-dlp  — CLI tool that extracts video info.
 *             We run it with --dump-json to get
 *             a JSON object with all metadata.
 *   spawn   — Node's way to run an external program
 *             and stream its output back to us.
 *   stdout  — "standard output" — the normal output
 *             stream of a program (like console.log).
 *   stderr  — "standard error" — where errors go.
 */

'use strict';

const express  = require('express');
const router   = express.Router();
const { spawn } = require('child_process');
const { validateUrl, detectPlatform } = require('../utils/urlValidator');
const { parseYtDlpFormats } = require('../utils/formatParser');

/**
 * POST /api/info
 * Body: { url: string }
 */
router.post('/', async (req, res, next) => {
  const { url } = req.body;

  // --- Validate input ---
  if (!url || typeof url !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'URL is required.',
    });
  }

  const trimmedUrl = url.trim();

  // Validate URL format and check it's a supported platform
  const validation = validateUrl(trimmedUrl);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      message: validation.message,
    });
  }

  const platform = detectPlatform(trimmedUrl);

  // --- Run yt-dlp to fetch metadata ---
  // --dump-json: output all info as JSON without downloading
  // --no-playlist: only fetch the single video, not a playlist
  // --geo-bypass: try to bypass geographic restrictions
  try {
    const data = await fetchVideoInfo(trimmedUrl);

    const formats = parseYtDlpFormats(data.formats || []);

    return res.json({
      success:   true,
      platform,
      title:     data.title     || 'Unknown Title',
      thumbnail: data.thumbnail || null,
      duration:  data.duration  || 0,
      uploader:  data.uploader  || data.channel || 'Unknown',
      view_count: data.view_count || 0,
      formats,
      // Pass through raw id for download step
      video_id: data.id,
    });

  } catch (err) {
    // Pass error to the global error handler
    return next(err);
  }
});

/**
 * Run yt-dlp and return parsed JSON metadata.
 * Returns a Promise that resolves with the video info object.
 *
 * @param {string} url - The video URL
 * @returns {Promise<Object>}
 */
function fetchVideoInfo(url) {
  return new Promise((resolve, reject) => {
    // Security: whitelist yt-dlp arguments — never interpolate user input
    // directly into shell commands.
    const args = [
      '--dump-json',        // output info as JSON
      '--no-playlist',      // single video only
      '--no-warnings',
      '--geo-bypass',
      '--socket-timeout', '15',
      '--retries', '3',
      url,                  // URL is passed as an argument, not shell-interpolated
    ];

    const ytdlp  = spawn('yt-dlp', args);
    let stdout   = '';
    let stderr   = '';

    ytdlp.stdout.on('data', chunk => { stdout += chunk.toString(); });
    ytdlp.stderr.on('data', chunk => { stderr += chunk.toString(); });

    // Set a timeout — kill the process if it hangs
    const timeout = setTimeout(() => {
      ytdlp.kill('SIGTERM');
      reject(new Error('Request timed out while fetching video info.'));
    }, 30_000); // 30 seconds

    ytdlp.on('close', code => {
      clearTimeout(timeout);

      if (code === 0 && stdout) {
        try {
          const info = JSON.parse(stdout.trim());
          resolve(info);
        } catch {
          reject(new Error('Failed to parse video metadata. The video may be unavailable.'));
        }
      } else {
        // Map common yt-dlp error messages to user-friendly ones
        const errMsg = stderr.toLowerCase();
        if (errMsg.includes('private video')) {
          reject(new Error('This video is private and cannot be downloaded.'));
        } else if (errMsg.includes('not available') || errMsg.includes('no video')) {
          reject(new Error('Video not found. It may have been deleted.'));
        } else if (errMsg.includes('age') || errMsg.includes('sign in')) {
          reject(new Error('This video requires sign-in or is age-restricted.'));
        } else if (errMsg.includes('copyright') || errMsg.includes('blocked')) {
          reject(new Error('This video is blocked due to copyright restrictions.'));
        } else {
          reject(new Error('Could not fetch video information. Please check the URL.'));
        }
      }
    });

    ytdlp.on('error', err => {
      clearTimeout(timeout);
      if (err.code === 'ENOENT') {
        reject(new Error('yt-dlp is not installed. Please install it on the server: pip install yt-dlp'));
      } else {
        reject(err);
      }
    });
  });
}

module.exports = router;
