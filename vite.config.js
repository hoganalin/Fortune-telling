import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

// Dev-only middleware: route /api/<name> to ./api/<name>.js (Vercel-style handler).
// Lets `npm run dev` work without `vercel dev`.
function apiDevPlugin() {
  return {
    name: 'api-dev-handler',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next()
        const name = req.url.split('?')[0].replace(/^\/api\//, '').replace(/\/$/, '')
        const filePath = resolve(process.cwd(), 'api', `${name}.js`)
        if (!existsSync(filePath)) return next()
        try {
          const mod = await server.ssrLoadModule(pathToFileURL(filePath).href)
          const handler = mod.default
          // Buffer body and parse JSON like Vercel does
          const chunks = []
          for await (const c of req) chunks.push(c)
          const raw = Buffer.concat(chunks).toString('utf8')
          if (raw && (req.headers['content-type'] || '').includes('application/json')) {
            try { req.body = JSON.parse(raw) } catch { req.body = {} }
          } else {
            req.body = {}
          }
          // Polyfill Vercel-style res helpers on top of Node http response
          res.status = (code) => { res.statusCode = code; return res }
          res.json = (obj) => {
            if (!res.getHeader('content-type')) res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify(obj))
            return res
          }
          res.send = (data) => {
            if (typeof data === 'object' && data !== null) return res.json(data)
            res.end(String(data ?? ''))
            return res
          }
          await handler(req, res)
        } catch (err) {
          console.error('[api-dev]', name, err)
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ error: 'dev handler crashed', detail: String(err?.message || err) }))
          }
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env into process.env so api/*.js handlers (which read process.env.*) work in dev.
  const env = loadEnv(mode, process.cwd(), '')
  for (const k of Object.keys(env)) {
    if (process.env[k] === undefined) process.env[k] = env[k]
  }
  return {
    plugins: [react(), tailwindcss(), apiDevPlugin()],
  }
})
