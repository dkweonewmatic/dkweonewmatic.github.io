// 비공개 저장소의 페이지 파일을 GitHub API로 받아 이 사이트의 경로로 내어 준다.
// 페이지 목록은 apps.js에 있다. 토큰은 접속 페이지(index.html)가 페이지별로 Cache Storage에 넣어 둔다.
// 토큰이 없거나 권한이 없으면 접속 페이지로 돌려보낸다.
importScripts('/apps.js');
const APPS = self.NM_APPS;
const AUTH_CACHE = 'nm-auth';
const TYPES = {
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8', md: 'text/markdown; charset=utf-8',
  webmanifest: 'application/manifest+json; charset=utf-8',
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', ico: 'image/x-icon',
  woff2: 'font/woff2', uasset: 'application/octet-stream',
};
const fileCache = (app, sha) => `nm-files-${app.id}-${sha}`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  const bare = APPS.find((a) => url.pathname === a.prefix.slice(0, -1));
  if (bare) { event.respondWith(Response.redirect(bare.prefix, 301)); return; }
  const app = APPS.find((a) => url.pathname.startsWith(a.prefix));
  if (app) event.respondWith(serve(app, event.request, url));
});

async function readAuth(app) {
  const cache = await caches.open(AUTH_CACHE);
  const token = await cache.match(`/__nm/${app.id}/token`);
  const sha = await cache.match(`/__nm/${app.id}/sha`);
  return { token: token ? await token.text() : '', sha: sha ? await sha.text() : '' };
}

const api = (app, path, token, accept) => fetch(`https://api.github.com/repos/${app.owner}/${app.repo}/${path}`, {
  headers: { Authorization: `Bearer ${token}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28' },
  cache: 'no-store',
});

// 페이지 첫 화면을 열 때마다 최신 커밋을 확인해, 바뀌었으면 새 파일을 받게 한다. 오프라인이면 기존 것을 쓴다.
async function refreshSha(app, token, current) {
  try {
    const res = await Promise.race([
      api(app, `commits/${app.branch}`, token, 'application/vnd.github.sha'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
    ]);
    if (res.status === 401 || res.status === 403 || res.status === 404) return { denied: true };
    if (!res.ok) return { sha: current };
    const sha = (await res.text()).trim();
    if (sha && sha !== current) {
      await (await caches.open(AUTH_CACHE)).put(`/__nm/${app.id}/sha`, new Response(sha));
      const keep = fileCache(app, sha);
      for (const name of await caches.keys()) if (name.startsWith(`nm-files-${app.id}-`) && name !== keep) await caches.delete(name);
    }
    return { sha: sha || current };
  } catch {
    return { sha: current };
  }
}

async function serve(app, request, url) {
  const navigate = request.mode === 'navigate';
  const deny = (reason, status) => (navigate ? Response.redirect(`/?error=${reason}&app=${app.id}`, 302) : new Response('', { status }));
  let { token, sha } = await readAuth(app);
  if (!token) return deny('login', 401);

  let rel = decodeURIComponent(url.pathname.slice(app.prefix.length));
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  if (rel.split('/').some((part) => part === '' || part === '.' || part === '..')) return new Response('', { status: 400 });
  const path = app.root + rel;

  if (navigate && rel === 'index.html') {
    const fresh = await refreshSha(app, token, sha);
    if (fresh.denied) return deny('auth', 401);
    sha = fresh.sha;
  }
  const ref = sha || app.branch;
  const cache = await caches.open(fileCache(app, ref));
  const key = `${url.origin}/${app.id}/${path}`;
  const hit = await cache.match(key);
  if (hit) return hit;

  let res;
  try {
    res = await api(app, `contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`, token, 'application/vnd.github.raw+json');
  } catch {
    return new Response('네트워크에 연결할 수 없습니다.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  if (res.status === 401) return deny('auth', 401);
  if (res.status === 403 || res.status === 429) return deny(res.headers.get('x-ratelimit-remaining') === '0' ? 'rate' : 'auth', res.status);
  if (!res.ok) return new Response('', { status: res.status });

  const ext = rel.split('.').pop().toLowerCase();
  const out = new Response(await res.arrayBuffer(), { status: 200, headers: { 'Content-Type': TYPES[ext] || 'application/octet-stream' } });
  if (ref !== app.branch) await cache.put(key, out.clone());
  return out;
}
