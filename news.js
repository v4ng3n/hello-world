// ===== Edit your feeds here =====
const FEEDS = [
  'https://ing.dk/rss/traffik',
  'https://www.dr.dk/nyheder/service/feeds/allenyheder',
  'https://nrkbeta.no/feed/',
  'https://feeds.arstechnica.com/arstechnica/index/',
  'http://feeds.howtogeek.com/HowToGeek',
  'http://feeds.ign.com/ign/games-all',
  'http://9to5mac.com/feed/',
  'http://news.ycombinator.com/rss'
];

// Always use AllOrigins to bypass CORS
const PROXY = 'https://api.allorigins.win/raw?url=';

// UI helpers
function setUpdatedStamp() {
  const el = document.getElementById('updated');
  if (!el) return;
  const now = new Date();
  el.textContent = `Updated: ${now.toLocaleTimeString([], { hour12: false })}`;
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

// Extract up to `max` items and the feed title
function extractFeed(xml, max = 5) {
  const feedTitle = xml.querySelector('channel > title, feed > title')?.textContent?.trim() || 'Feed';
  const nodes = Array.from(xml.querySelectorAll('item, entry'));
  // Sort newest first inside the feed
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
    const pub = node.querySelector('pubDate, updated, published')?.textContent || '';
    const desc = node.querySelector('description, summary, content')?.textContent || '';
    return { title, link, pub, desc };
  });

  return { feedTitle, items };
}

function renderFeedSection(container, title, items) {
  // Section heading
  const h2 = document.createElement('h2');
  h2.textContent = title;
  container.appendChild(h2);

  // Grid of cards for this feed
  const grid = document.createElement('div');
  grid.className = 'grid';
  items.forEach(item => {
    const card = document.createElement('article');
    card.className = 'card';
    const dateStr = item.pub ? new Date(item.pub).toLocaleString() : '';
    const short = item.desc ? item.desc.replace(/<[^>]*>/g, '').slice(0, 200) : '';
    card.innerHTML = `
      <h3><a href="${item.link}" target="_blank" rel="noopener noreferrer">${item.title}</a></h3>
      <div class="meta">${dateStr ? `<span>${dateStr}</span>` : ''}</div>
      ${short ? `<div>${short}…</div>` : ''}
    `;
    grid.appendChild(card);
  });
  container.appendChild(grid);
}

async function refresh() {
  const status = document.getElementById('status');
  const articlesRoot = document.getElementById('articles');
  articlesRoot.innerHTML = '';
  status.textContent = 'Loading feeds…';

  // Fetch feeds in the same order as FEEDS, each limited to 5 items
  const results = await Promise.allSettled(
    FEEDS.map(async (url) => {
      const xml = await fetchFeed(url);
      return extractFeed(xml, 5);
    })
  );

  // Render feed-by-feed in FEEDS order
  const failed = [];
  results.forEach((r, idx) => {
    if (r.status === 'fulfilled') {
      const { feedTitle, items } = r.value;
      renderFeedSection(articlesRoot, feedTitle, items);
    } else {
      failed.push(FEEDS[idx]);
    }
  });

  status.innerHTML = failed.length
    ? '<span class="error">Some feeds failed to load:</span> ' + failed.map(u => { try { return new URL(u).hostname; } catch { return u; } }).join(', ')
    : 'All feeds loaded.';

  setUpdatedStamp();
}

// Wire up after DOM is ready (defer in <script> tag ensures this file loads after HTML)
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('refreshBtn')?.addEventListener('click', refresh);
  refresh();
});
