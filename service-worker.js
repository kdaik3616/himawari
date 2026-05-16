// デプロイ時にこの日付を更新すること → 旧キャッシュが自動削除される
const CACHE_NAME = 'himawari-20260516';
const STATIC_ASSETS = [
  './',
  './index.html',
  './himawari-logo.png',
  './manifest.json'
];

// インストール: 静的ファイルをキャッシュして即座にアクティベート
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// アクティベート: 旧バージョンのキャッシュを全削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// フェッチ: 自サイトのリクエストのみ処理
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // 自サイト以外はスルー（Firebase・CDN等は直接通信）
  if (url.origin !== self.location.origin) return;

  // クエリパラメータ付き（更新確認・nocache）はネットワーク優先
  if (url.search) {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // HTMLナビゲーション: ネットワーク優先 → オフライン時はキャッシュ
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

  // 静的ファイル（画像・JSON）: キャッシュ優先 → ネットワークフォールバック
  if (url.pathname.match(/\.(png|jpg|json|js|css|woff2?)$/)) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone));
          }
          return res;
        });
      })
    );
  }
});
