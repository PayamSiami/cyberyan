// Minimal static server for the built frontend (dist/) with /api proxy to the
// backend. In-process only — no child processes, works inside the sandbox.
import http from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = resolve(fileURLToPath(new URL('./dist', import.meta.url)))
const BACKEND = process.env.BACKEND_ORIGIN ?? 'http://127.0.0.1:3000'
const PORT = Number(process.env.PORT ?? 4173)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

function proxy(req, res) {
  const upstream = new URL(req.url, BACKEND)
  const headers = { ...req.headers }
  headers.host = upstream.host
  const out = http.request(
    {
      protocol: upstream.protocol,
      hostname: upstream.hostname,
      port: upstream.port || 80,
      path: upstream.pathname + upstream.search,
      method: req.method,
      headers,
    },
    (ur) => {
      res.writeHead(ur.statusCode ?? 502, ur.headers)
      ur.pipe(res)
    },
  )
  out.on('error', (err) => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ message: `Proxy error: ${err.message}` }))
  })
  req.pipe(out)
}

function serveStatic(res, path) {
  let filePath = join(DIST, normalize(path).replace(/^([.][.][/\\])+/, ''))
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403)
    return res.end('Forbidden')
  }
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    // SPA fallback
    filePath = join(DIST, 'index.html')
  }
  const type = MIME[extname(filePath)] ?? 'application/octet-stream'
  res.writeHead(200, { 'content-type': type })
  createReadStream(filePath).pipe(res)
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) return proxy(req, res)
  return serveStatic(res, req.url === '/' ? '/index.html' : req.url)
})

server.listen(PORT, () => {
  console.log(`cyberyan-frontend serving ${DIST}`)
  console.log(`API proxied to ${BACKEND}`)
  console.log(`URL: http://127.0.0.1:${PORT}/`)
})
