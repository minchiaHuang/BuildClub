// Small local API for live TikTok search through Apify.
// Keeps the Apify token on this machine (never sent to the browser) and caches each search on disk,
// so repeating a search costs nothing.
//
// Run: npm run api   (reads APIFY_TOKEN from .env)

import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const PORT = Number(process.env.API_PORT ?? 8787)
const TOKEN = process.env.APIFY_TOKEN?.trim()
const ACTOR = process.env.APIFY_TIKTOK_ACTOR ?? 'clockworks~tiktok-scraper'
const RESULTS_PER_SEARCH = Number(process.env.RESULTS_PER_SEARCH ?? 30)
const CACHE_HOURS = Number(process.env.CACHE_HOURS ?? 24)
const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'cache')

const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

const cacheFile = (query) =>
  join(CACHE_DIR, `${createHash('sha1').update(`${ACTOR}|${RESULTS_PER_SEARCH}|${query}`).digest('hex')}.json`)

async function readCache(query) {
  try {
    const saved = JSON.parse(await readFile(cacheFile(query), 'utf8'))
    const ageHours = (Date.now() - saved.fetchedAt) / 3_600_000
    return ageHours < CACHE_HOURS ? saved : null
  } catch {
    return null
  }
}

// Only the fields the app uses, so the cache stays small.
function trim(item) {
  return {
    id: String(item.id ?? ''),
    text: item.text ?? '',
    url: item.webVideoUrl ?? '',
    createTime: item.createTimeISO ?? (item.createTime ? new Date(item.createTime * 1000).toISOString() : null),
    plays: item.playCount ?? 0,
    likes: item.diggCount ?? 0,
    comments: item.commentCount ?? 0,
    shares: item.shareCount ?? 0,
    saves: item.collectCount ?? null,
    duration: item.videoMeta?.duration ?? 0,
    cover: item.videoMeta?.coverUrl ?? item.videoMeta?.originalCoverUrl ?? '',
    author: item.authorMeta?.name ?? '',
    followers: item.authorMeta?.fans ?? 0,
    music: item.musicMeta ? `${item.musicMeta.musicName ?? ''} · ${item.musicMeta.musicAuthor ?? ''}`.trim() : '',
    musicOriginal: Boolean(item.musicMeta?.musicOriginal),
    hashtags: (item.hashtags ?? []).map((h) => h?.name).filter(Boolean),
  }
}

async function searchTikTok(query) {
  const url = `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?timeout=240`
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({
      searchQueries: [query],
      resultsPerPage: RESULTS_PER_SEARCH,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSubtitles: false,
      shouldDownloadSlideshowImages: false,
    }),
  })
  if (!r.ok) {
    const detail = await r.text()
    throw new Error(`Apify returned ${r.status}: ${detail.slice(0, 300)}`)
  }
  const items = await r.json()
  return items.filter((i) => i && i.playCount !== undefined && i.webVideoUrl).map(trim)
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

  if (url.pathname === '/api/health') {
    return send(res, 200, { live: Boolean(TOKEN), platforms: ['tiktok'], resultsPerSearch: RESULTS_PER_SEARCH })
  }

  if (url.pathname === '/api/search') {
    const query = (url.searchParams.get('q') ?? '').trim().slice(0, 120)
    const fresh = url.searchParams.get('fresh') === '1'
    if (!query) return send(res, 400, { error: 'Type something to search.' })
    if (!TOKEN) return send(res, 503, { error: 'Live search is off. Add APIFY_TOKEN to .env and restart the API.' })

    if (!fresh) {
      const cached = await readCache(query)
      if (cached) return send(res, 200, { ...cached, cached: true })
    }
    try {
      const videos = await searchTikTok(query)
      const payload = { query, platform: 'tiktok', fetchedAt: Date.now(), videos }
      await mkdir(CACHE_DIR, { recursive: true })
      await writeFile(cacheFile(query), JSON.stringify(payload))
      console.log(`[search] "${query}" → ${videos.length} videos`)
      return send(res, 200, { ...payload, cached: false })
    } catch (err) {
      console.error('[search] failed:', err.message)
      return send(res, 502, { error: 'TikTok search failed. Check the API terminal for details.', detail: err.message })
    }
  }

  send(res, 404, { error: 'Not found' })
}).listen(PORT, () => {
  console.log(`Trend Finder API on http://localhost:${PORT} · live search ${TOKEN ? 'ON' : 'OFF (no APIFY_TOKEN)'}`)
})
