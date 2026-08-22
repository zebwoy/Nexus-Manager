import { put } from '@vercel/blob'
import { ok, err } from './_db.js'

/**
 * POST /api/blob-upload
 * Uploads a logo image to Vercel Blob storage.
 *
 * Expects: multipart/form-data or raw binary body with
 *   - req.headers['x-filename']     : file name (e.g. "logo.png")
 *   - req.headers['x-content-type'] : MIME type (e.g. "image/png")
 *   - req.headers['x-schema-name']  : the org's schema name (for namespacing the blob path)
 *   - req.body                      : raw file buffer (handled by Netlify/Vercel as binary)
 *
 * IMPORTANT: In Vercel Edge / Netlify Functions, set `bodyParser: false` or handle
 * binary content. The Vite dev proxy pipes the raw body through unchanged.
 *
 * Returns: { url: 'https://...' }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return err(res, 'Method not allowed', 405)
  }

  // Require BLOB_READ_WRITE_TOKEN in environment
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return err(res, 'Vercel Blob is not configured. Please add BLOB_READ_WRITE_TOKEN to your environment variables.', 503)
  }

  const filename = req.headers['x-filename'] || 'logo.png'
  const contentType = req.headers['x-content-type'] || 'image/png'
  const schemaName = req.headers['x-schema-name'] || 'org'

  // Validate content type
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
  if (!allowedTypes.includes(contentType)) {
    return err(res, 'Only PNG, JPEG, WebP, and SVG files are allowed for logos.', 400)
  }

  try {
    // Build a namespaced blob path: logos/<schema>/<timestamp>-<filename>
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase()
    const blobPath = `logos/${schemaName}/${Date.now()}-${safeName}`

    // Get the raw body as a buffer
    const body = req.body
    if (!body || (Buffer.isBuffer(body) && body.length === 0)) {
      return err(res, 'No file data received', 400)
    }

    const blob = await put(blobPath, body, {
      access: 'public',
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
    })

    return ok(res, { url: blob.url, downloadUrl: blob.downloadUrl, pathname: blob.pathname })
  } catch (e) {
    console.error('Blob upload error:', e)
    return err(res, 'Upload failed: ' + (e.message || 'Unknown error'), 500)
  }
}
