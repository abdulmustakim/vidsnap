/**
 * URL Validator & Platform Detector
 * -----------------------------------
 * VOCABULARY:
 *   Regex  — Regular Expression. A pattern used to
 *            search or validate text. Like a smart
 *            filter that checks if a string matches
 *            a specific structure.
 *   .test() — a regex method that returns true/false
 *             based on whether the pattern matches.
 */

'use strict';

// Supported platforms with their URL patterns
const PLATFORMS = [
  {
    name:  'YouTube',
    slug:  'youtube',
    color: '#ff0000',
    regex: /(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  },
  {
    name:  'Instagram',
    slug:  'instagram',
    color: '#e1306c',
    regex: /instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/,
  },
  {
    name:  'Twitter',
    slug:  'twitter',
    color: '#1da1f2',
    regex: /(?:twitter|x)\.com\/\w+\/status\/(\d+)/,
  },
  {
    name:  'Facebook',
    slug:  'facebook',
    color: '#1877f2',
    regex: /(?:facebook\.com\/.*\/videos\/|fb\.watch\/)(\d+|[\w-]+)/,
  },
  {
    name:  'TikTok',
    slug:  'tiktok',
    color: '#010101',
    regex: /tiktok\.com\/@[\w.]+\/video\/(\d+)/,
  },
  {
    name:  'Vimeo',
    slug:  'vimeo',
    color: '#1ab7ea',
    regex: /vimeo\.com\/(\d+)/,
  },
  {
    name:  'Dailymotion',
    slug:  'dailymotion',
    color: '#0066dc',
    regex: /dailymotion\.com\/video\/([\w]+)/,
  },
];

// Blocked domains for security (avoid SSRF attacks)
// SSRF = Server-Side Request Forgery: attacker tricks
// server into making requests to internal network.
const BLOCKED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '10.',
  '192.168.',
  '172.16.',
  'metadata.google',
  '169.254.', // AWS/GCP metadata endpoint
];

/**
 * Validate a URL and check for security issues.
 *
 * @param {string} url
 * @returns {{ valid: boolean, message?: string }}
 */
function validateUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, message: 'Please provide a valid URL.' };
  }

  if (url.length > 2048) {
    return { valid: false, message: 'URL is too long.' };
  }

  // Must be valid URL syntax
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, message: 'Invalid URL format. Make sure to include https://' };
  }

  // Must use http or https
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, message: 'Only HTTP and HTTPS URLs are supported.' };
  }

  // Block internal network requests (SSRF prevention)
  const hostname = parsed.hostname.toLowerCase();
  for (const blocked of BLOCKED_DOMAINS) {
    if (hostname.startsWith(blocked) || hostname === blocked.replace('.', '')) {
      return { valid: false, message: 'That URL is not allowed.' };
    }
  }

  // Must be a supported platform
  const platform = detectPlatform(url);
  if (!platform) {
    return {
      valid: false,
      message: 'Unsupported platform. We support YouTube, Instagram, Twitter/X, Facebook, TikTok, Vimeo, and Dailymotion.',
    };
  }

  return { valid: true };
}

/**
 * Identify which platform a URL belongs to.
 *
 * @param {string} url
 * @returns {{ name, slug, color } | null}
 */
function detectPlatform(url) {
  for (const platform of PLATFORMS) {
    if (platform.regex.test(url)) {
      return {
        name:  platform.name,
        slug:  platform.slug,
        color: platform.color,
      };
    }
  }
  return null;
}

module.exports = { validateUrl, detectPlatform, PLATFORMS };
