/**
 * /api/download — Stream Video or Audio to the User
 * ---------------------------------------------------
 * Accepts: GET ?url=...&format=...&type=video|audio
 * Returns: Binary file stream (video or MP3)
 *
 * VOCABULARY:
 *   Stream    — sending data in chunks as it arrives,
 *               instead of waiting for the whole file.
 *               Like watching a river flow vs. waiting
 *               for a bucket to fill up.
 *   Pipe      — connecting one stream to another.
 *               yt-dlp output → piped → HTTP response.
 *   Content-Disposition — HTTP header that tells the
 *               browser to save the file with a name.
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const { spawn }  = require('child_process');
const { validateUrl, detectPlatform } = require('../utils/urlValidator');
const { sanitizeFilename } = require('../utils/formatParser');

/**
 * GET /api/download?url=...&format=720p&type=video
 *
 * Streams the video/audio directly to the client.
 * We never save anything to disk — it streams through.
 */
router.get('/', async (req, res, next) => {
  const { url, format = 'best', type = 'video' } = req.query;

  // --- Validate ---
  if (!url) {
    return res.status(400).json({ success: false, message: 'URL is required.' });
  }

  const trimmedUrl = url.trim();
  const validation = validateUrl(trimmedUrl);

  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }

  // Validate type
  const dlType = ['video', 'audio'].includes(type) ? type : 'video';

  // Map quality string to yt-dlp format selector
  // These selectors tell yt-dlp which format to pick.
  const formatSelector = buildFormatSelector(format, dlType);

  // --- Build yt-dlp arguments ---
  const args = buildYtdlpArgs(trimmedUrl, formatSelector, dlType);

  // --- Set response headers before streaming ---
  const extension = dlType === 'audio' ? 'mp3' : 'mp4';
  const contentType = dlType === 'audio' ? 'audio/mpeg' : 'video/mp4';
  const filename = sanitizeFilename(`vidsnap-download-${Date.now()}.${extension}`);

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Transfer-Encoding', 'chunked');

  // --- Spawn yt-dlp and pipe output to response ---
  const ytdlp = spawn('yt-dlp', args);
  let hasStartedStreaming = false;

  ytdlp.stdout.on('data', chunk => {
    hasStartedStreaming = true;
    // Write each chunk directly to the HTTP response
    if (!res.writableEnded) res.write(chunk);
  });

  let errorOutput = '';
  ytdlp.stderr.on('data', chunk => {
    errorOutput += chunk.toString();
  });

  ytdlp.on('close', code => {
    if (!res.writableEnded) {
      if (code === 0) {
        res.end();
      } else if (!hasStartedStreaming) {
        // Only send error JSON if we haven't started streaming yet
        res.status(500).json({
          success: false,
          message: 'Download failed. The video may be unavailable or protected.',
        });
      } else {
        res.end(); // stream was partially sent — just close it
      }
    }
  });

  ytdlp.on('error', err => {
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: err.code === 'ENOENT'
          ? 'yt-dlp is not installed on the server.'
          : 'A server error occurred during download.',
      });
    }
  });

  // If client disconnects, kill yt-dlp to free resources
  req.on('close', () => {
    ytdlp.kill('SIGTERM');
  });
});

/**
 * Build yt-dlp format selector string.
 *
 * yt-dlp format selectors are a mini-language:
 *   "bestvideo[height<=720]+bestaudio/best[height<=720]"
 *   means: pick best video stream up to 720p AND best
 *   audio stream, merged together. Fallback to best
 *   combined format up to 720p.
 *
 * @param {string} format - e.g. "720p", "1080p", "bestaudio"
 * @param {string} type   - "video" or "audio"
 * @returns {string}
 */
function buildFormatSelector(format, type) {
  if (type === 'audio') {
    return 'bestaudio/best';
  }

  // Map quality labels to height constraints
  const heightMap = {
    '1080p': 1080,
    '720p':  720,
    '480p':  480,
    '360p':  360,
    '240p':  240,
    '144p':  144,
    'best':  null,
  };

  const height = heightMap[format];

  if (!height) {
    return 'bestvideo+bestaudio/best'; // Best available
  }

  // Request specific quality with fallback
  return `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/bestvideo+bestaudio`;
}

/**
 * Build the full array of yt-dlp CLI arguments.
 *
 * @param {string} url
 * @param {string} formatSelector
 * @param {string} type - "video" or "audio"
 * @returns {string[]}
 */
function buildYtdlpArgs(url, formatSelector, type) {
  const baseArgs = [
    '-f', formatSelector,
    '--no-playlist',
    '--geo-bypass',
    '--socket-timeout', '20',
    '-o', '-',          // "-" means output to stdout (pipe) instead of file
  ];

  if (type === 'audio') {
    return [
      ...baseArgs,
      '-x',                    // extract audio
      '--audio-format', 'mp3', // convert to MP3
      '--audio-quality', '0',  // best quality (0 = best, 9 = worst)
      url,
    ];
  }

  // For video: merge video + audio streams into MP4
  return [
    ...baseArgs,
    '--merge-output-format', 'mp4',
    url,
  ];
}

module.exports = router;
