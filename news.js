// ===== Edit your feeds here =====
const FEEDS = [
  // Danmark
  'https://www.dr.dk/nyheder/service/feeds/senestenyt',
  'https://www.dr.dk/nyheder/service/feeds/politik',
  'https://www.dr.dk/nyheder/service/feeds/sporten',
  'https://www.dr.dk/nyheder/service/feeds/viden',

  // Norway
  'https://www.nrk.no/nyheder/siste.rss',

  // Transport/urbanism
  'https://ing.dk/rss/trafik',
  'https://www.cyklistforbundet.dk/rss/nyheder',

  // Tech
  'https://feeds.arstechnica.com/arstechnica/index/',
  'https://www.techradar.com/rss',
  'https://9to5mac.com/feed/',
  'https://feeds.howtogeek.com/HowToGeek',
  'https://news.ycombinator.com/rss',
  'https://hackaday.com/blog/feed/',

  // Gaming
  'https://feeds.ign.com/ign/games-all',
  'https://www.eurogamer.net/?format=rss',
  'https://www.pcgamer.com/rss/'
];

// Always use AllOrigins to bypass CORS
const PROXY = 'https://api.allorigins.win/raw?url=';

// ---- Date helpers ----
function pad2(n) { return String(n).padStart(2, '0'); }
function parseDateSafe(s) {
  const t = Date.parse(s || '');
  return isNaN(t) ? null : new Date(t);
}
function formatEU(dt) {
  const d = pad2(dt.getDate()), m = pad2(dt.getMonth() + 1), y = dt.getFullYear();
  const hh = pad2(dt.getHours()), mm = pad2(dt.getMinutes()), ss = pad2(dt.getSeconds());
  return `${d}.${m}.${y}, ${hh}.${mm}.${ss}`;
}

// UI helpers
function setUpdatedStamp() {
  const el = document.getElementById('updated');
  if (!el) return;
  el.textContent = `Updated: ${formatEU(new Date())}`;
}

async function fetchViaProxy(url) {
  const proxied = PROXY + encodeURIComponent(url);
  const res = await fetch(proxied, {
    headers: { 'Accept': 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8' }
  });
  if (!res.ok) throw new Error(`Proxy ${res.status}`);
  return res.text();
}

async function fetchFeed(url) {
  const xmlText = await fetchViaProxy(url);
  const xml = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error('Invalid XML');
  return xml;
}

/* -------- Image helpers -------- */
function getAttr(el, names) {
  for (const n of names) {
    const v = el?.getAttribute?.(n);
    if (v) return v;
  }
  return '';
}
function pickFirstImgFromHTML(htmlString) {
  if (!htmlString) return '';
  const doc = new DOMParser().parseFromString(htmlString, 'text/html');
  const img = doc.querySelector('img[src]');
  return img ? img.getAttribute('src') : '';
}
function absolutize(url) {
  if (!url) return '';
  try {
    return new URL(url, location.href).href;
  } catch {
    if (url.startsWith('//')) return 'https:' + url;
    return url;
  }
}
function extractImageFromItem(node) {
  // 1) <enclosure type="image/*" url="...">
  const enc = node.querySelector('enclosure[url]');
  if (enc && /image\//i.test(enc.getAttribute('type') || '')) {
    return absolutize(enc.getAttribute('url'));
  }
  // 2) <media:content> / <media:thumbnail>
  const mediaContent = node.getElementsByTagName('media:content')[0];
  if (mediaContent) return absolutize(getAttr(mediaContent, ['url', 'src']));
  const mediaThumb = node.getElementsByTagName('media:thumbnail')[0];
  if (mediaThumb) return absolutize(getAttr(mediaThumb, ['url', 'src']));
  // 3) First <img> in content/description
  const contentEncoded = node.getElementsByTagName('content:encoded')[0]?.textContent || '';
  const fromContent = pickFirstImgFromHTML(contentEncoded);
  if (fromContent) return absolutize(fromContent);
  const description = node.querySelector('description')?.textContent || '';
  const fromDesc = pickFirstImgFromHTML(description);
  if (fromDesc) return absolutize(fromDesc);
  return '';
}

/* ---- Extract up to 10 items per feed (newest first) ---- */
function extractFeed(xml, max = 10) {
  const feedTitle = xml.querySelector('channel > title, feed > title')?.textContent?.trim() || 'Feed';
  const nodes = Array.from(xml.querySelectorAll('item, entry'));

  const sorted = nodes.sort((a, b) => {
    const ta = Date.parse(a.querySelector('pubDate, updated, published')?.textContent || '') || 0;
    const tb = Date.parse(b.querySelector('pubDate, updated, published')?.textContent || '') || 0;
    return tb - ta;
  }).slice(0, max);

  const items = sorted.map(node => {
    const title = node.querySelector('title')?.textContent?.trim() || 'Untitled';
    const linkEl = node.querySelector('link');
    const href = (linkEl?.getAttribute?.('href')) || (linkEl?.textContent) || '#';
    const link = href && href.startsWith('http') ? href : href?.replace(/^\/+/, 'https://') || '#';
    const pub = parseDateSafe(node.querySelector('pubDate, updated, published')?.textContent || '');
    const desc = node.querySelector('description, summary, content')?.textContent || '';
    const img = extractImageFromItem(node);
    return { title, link, pub, desc, img };
  });

  return { feedTitle, items };
}

/* ---- Render: title on top, 10 cards in one horizontal row; photo under text ---- */
function renderFeedSection(container, title, items) {
  const section = document.createElement('section');
  section.className = 'feed-section';

  const h2 = document.createElement('h2');
  h2.textContent = title;
  section.appendChild(h2);

  const row = document.createElement('div');
  row.className = 'articles-row';

  items.forEach(item => {
    const card = document.createElement('article');
    card.className = 'card';
    const dateStr = item.pub ? formatEU(item.pub) : '';
    const short = item.desc ? item.desc.replace(/<[^>]*>/g, '').slice(0, 200) : '';
    const thumb = item.img ? `<img class="thumb" src="${item.img}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '';

    card.innerHTML = `
      <h3><a href="${item.link}" target="_blank" rel="noopener noreferrer">${item.title}</a></h3>
      <div class="meta">${dateStr ? `<span>${dateStr}</span>` : ''}</div>
      ${short ? `<div>${short}…</div>` : ''}
      ${thumb}
    `;
    row.appendChild(card);
  });

  section.appendChild(row);
  container.appendChild(section);
}

async function refresh() {
  const status = document.getElementById('status');
  const root = document.getElementById('articles');
  root.innerHTML = '';
  status.textContent = 'Loading feeds…';

  const results = await Promise.allSettled(
    FEEDS.map(async (url) => {
      const xml = await fetchFeed(url);
      return extractFeed(xml, 10);
    })
  );

  const failed = [];
  results.forEach((r, idx) => {
    if (r.status === 'fulfilled') {
      const { feedTitle, items } = r.value;
      renderFeedSection(root, feedTitle, items);
    } else {
      failed.push(FEEDS[idx]);
    }
  });

  status.innerHTML = failed.length
    ? '<span class="error">Some feeds failed to load:</span> ' + failed.map(u => { try { return new URL(u).hostname; } catch { return u; } }).join(', ')
    : 'All feeds loaded.';

  setUpdatedStamp();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('refreshBtn')?.addEventListener('click', refresh);
  refresh();
});
