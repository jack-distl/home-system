import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.ts'
import { getSettings } from './db.ts'
import type { Artwork } from '../shared/types.ts'

// Art mode shows your own images from art/, plus (optionally) public-domain paintings from the
// Art Institute of Chicago's open API. Downloaded works are cached in data/art-cache so the
// screen keeps working when the internet is down.

const IMAGE_EXT = /\.(jpe?g|png|webp|avif)$/i
const cacheDir = path.join(config.dataDir, 'art-cache')
fs.mkdirSync(cacheDir, { recursive: true })

interface CachedWork extends Artwork {
  file: string
}

const manifestPath = path.join(cacheDir, 'manifest.json')
/** Bump the prefix when the selection rules change so existing caches are refetched. */
const cacheKey = (query: string) => `paintings-v1:${query}`

function readManifest(): { query: string; works: CachedWork[] } {
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch {
    return { query: '', works: [] }
  }
}

function localArt(): Artwork[] {
  if (!fs.existsSync(config.artDir)) return []
  return fs
    .readdirSync(config.artDir)
    .filter((f) => IMAGE_EXT.test(f))
    .map((f) => ({ url: `/art-files/local/${encodeURIComponent(f)}`, title: path.parse(f).name.replace(/[-_]+/g, ' '), artist: '' }))
}

export function listArt(): Artwork[] {
  const local = localArt()
  const settings = getSettings()
  if (settings.artSource === 'local' && local.length) return local
  const cached = readManifest().works.filter((w) => fs.existsSync(path.join(cacheDir, w.file)))
  return [...local, ...cached.map(({ file, ...w }) => ({ ...w, url: `/art-files/cache/${encodeURIComponent(file)}` }))]
}

let refreshing = false

/** Download a fresh set of landscape-friendly public-domain paintings for the current search term. */
export async function refreshArtCache(force = false) {
  const settings = getSettings()
  if (settings.artSource !== 'aic' || refreshing) return
  const manifest = readManifest()
  if (!force && manifest.query === cacheKey(settings.artQuery) && manifest.works.length >= 20) return
  refreshing = true
  try {
    const params = new URLSearchParams({
      q: settings.artQuery,
      // Public-domain paintings only (not prints, photos or objects).
      'query[bool][must][0][term][is_public_domain]': 'true',
      'query[bool][must][1][term][artwork_type_id]': '1',
      fields: 'id,title,artist_title,image_id,thumbnail',
      limit: '100',
    })
    const headers = { 'AIC-User-Agent': 'home-planner (family wall calendar)' }
    const res = await fetch(`https://api.artic.edu/api/v1/artworks/search?${params}`, { headers })
    const json = (await res.json()) as { data: { id: number; title: string; artist_title: string | null; image_id: string | null; thumbnail: { width: number; height: number } | null }[] }
    // Prefer landscape works so they fill a landscape screen nicely.
    const candidates = json.data.filter((w) => w.image_id && w.thumbnail && w.thumbnail.width >= w.thumbnail.height * 1.15).slice(0, 40)
    const works: CachedWork[] = []
    for (const w of candidates) {
      const file = `${w.id}.jpg`
      const target = path.join(cacheDir, file)
      if (!fs.existsSync(target)) {
        const img = await fetch(`https://www.artic.edu/iiif/2/${w.image_id}/full/1686,/0/default.jpg`, { headers })
        if (!img.ok) continue
        fs.writeFileSync(target, Buffer.from(await img.arrayBuffer()))
      }
      works.push({ file, url: '', title: w.title, artist: w.artist_title ?? '' })
    }
    if (works.length) {
      const keep = new Set(works.map((w) => w.file))
      for (const f of fs.readdirSync(cacheDir)) if (f.endsWith('.jpg') && !keep.has(f)) fs.rmSync(path.join(cacheDir, f))
      fs.writeFileSync(manifestPath, JSON.stringify({ query: cacheKey(settings.artQuery), works }, null, 2))
    }
  } catch (err) {
    console.warn('Could not refresh art:', (err as Error).message)
  } finally {
    refreshing = false
  }
}

export const artCacheDir = cacheDir
