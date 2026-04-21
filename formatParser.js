/**
 * Format Parser — cleans up yt-dlp's raw format data
 * -----------------------------------------------------
 * yt-dlp returns dozens of raw format objects.
 * This module picks the best ones and presents them
 * cleanly to the frontend.
 *
 * VOCABULARY:
 *   format_id — yt-dlp's internal identifier for each
 *               available stream (e.g. "137" for 1080p video)
 *   vcodec    — video codec (encoding format, e.g. "avc1", "vp9")
 *   acodec    — audio codec (e.g. "mp4a", "opus")
 *   tbr       — total bit rate (video + audio, in kbps)
 *   filesize  — byte size of the format, if known
 */

'use strict';

// The quality labels we expose to the user, in order
const QUALITY_LEVELS = [2160, 1440, 1080, 720, 480, 360, 240, 144];

/**
 * Parse raw yt-dlp formats into a clean list for the frontend.
 * Only includes video formats with a known height.
 * De-duplicates: one entry per quality level.
 *
 * @param {Object[]} rawFormats - array from yt-dlp JSON
 * @returns {Array<{ format_id, quality, filesize, ext, vcodec }>}
 */
function parseYtDlpFormats(rawFormats) {
  if (!Array.isArray(rawFormats) || rawFormats.length === 0) {
    return defaultFormats();
  }

  const seen   = new Set();   // track which heights we've already added
  const result = [];

  // Sort by height descending so we always pick best version of each quality
  const videoFormats = rawFormats
    .filter(f => f.height && f.vcodec && f.vcodec !== 'none')
    .sort((a, b) => (b.height || 0) - (a.height || 0));

  for (const quality of QUALITY_LEVELS) {
    // Find the best format at or below this quality
    const match = videoFormats.find(f => f.height <= quality && !seen.has(f.height));
    if (match) {
      seen.add(match.height);
      result.push({
        format_id: match.format_id,
        quality:   `${match.height}p`,
        filesize:  formatFilesize(match.filesize),
        ext:       match.ext || 'mp4',
        vcodec:    match.vcodec?.split('.')[0] || 'h264',
      });
    }
  }

  // Always include a "best" option as fallback
  if (result.length === 0) return defaultFormats();

  return result;
}

/**
 * Convert bytes to human-readable size string.
 * e.g. 52428800 → "50 MB"
 *
 * @param {number|null} bytes
 * @returns {string}
 */
function formatFilesize(bytes) {
  if (!bytes || isNaN(bytes)) return '—';
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576)     return `${Math.round(bytes / 1_048_576)} MB`;
  if (bytes >= 1024)          return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/**
 * Return a default format list when yt-dlp data is unavailable.
 * This ensures the UI always has something to show.
 */
function defaultFormats() {
  return [
    { format_id: 'best[height<=1080]', quality: '1080p', filesize: '~380 MB', ext: 'mp4', vcodec: 'h264' },
    { format_id: 'best[height<=720]',  quality: '720p',  filesize: '~180 MB', ext: 'mp4', vcodec: 'h264' },
    { format_id: 'best[height<=480]',  quality: '480p',  filesize: '~90 MB',  ext: 'mp4', vcodec: 'h264' },
    { format_id: 'best[height<=360]',  quality: '360p',  filesize: '~50 MB',  ext: 'mp4', vcodec: 'h264' },
    { format_id: 'best[height<=144]',  quality: '144p',  filesize: '~15 MB',  ext: 'mp4', vcodec: 'h264' },
  ];
}

/**
 * Remove dangerous characters from a filename.
 * Prevents directory traversal and shell injection.
 *
 * @param {string} name
 * @returns {string}
 */
function sanitizeFilename(name) {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_') // only allow safe chars
    .replace(/\.{2,}/g, '.')            // no ".." (directory traversal)
    .slice(0, 200);                     // max 200 chars
}

module.exports = { parseYtDlpFormats, formatFilesize, sanitizeFilename, defaultFormats };
