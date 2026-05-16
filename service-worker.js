const CACHE_NAME = 'himawari-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './himawari-logo.png',
  './manifest.json'
];

// インストール: 静的ファイルをキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// アクティベート: 古いキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// フェッチ: ナビゲーションはネットワーク優先、静的リソースはキャッシュ優先
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // 同一オリジン以外はスルー
  if (url.origin !== location.origin) return;

  // Firebase REST APIはキャッシュしない
  if (url.hostname.includes('googleapis') || url.hostname.includes('firebase')) return;

  // HTMLナビゲーション: ネットワーク優先 → キャッシュフォールバック
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 静的リソース: キャッシュ優先 → ネットワークフォールバック
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res.ok && (url.pathname.endsWith('.png') || url.pathname.endsWith('.json'))) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return res;
      });
    })
  );
});
