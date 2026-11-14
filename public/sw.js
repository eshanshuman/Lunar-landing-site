// Offline cache for the installable app (scope item 7).
// Network first for pages (so a new deploy shows up), cache first for everything else
// (hashed JS/CSS, textures, data). Everything the app fetches from its own origin is cached on first use.
const CACHE = 'lsn-v2'
// The 3D shadow view's terrain tiles are cached up front so every site works offline, not only the ones already opened.
const TILES = ['ridge', 'shack', 'degerl', 'peak', 'nobile'].flatMap((s) => [`./data/tile_${s}.json`, `./data/tile_${s}.png`])
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './data/backtest.json', ...TILES]

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  const put = (res) => {
    if (res.ok && res.type === 'basic') {
      const copy = res.clone()
      caches.open(CACHE).then((c) => c.put(req, copy))
    }
    return res
  }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(put).catch(() => caches.match(req).then((r) => r || caches.match('./'))))
    return
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then(put)))
})
