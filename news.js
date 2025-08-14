// ===== Edit your feeds here =====
const FEEDS = [
  'https://www.dr.dk/nyheder/service/feeds/allenyheder',
  'https://www.dr.dk/nyheder/service/feeds/politik',
  'https://nrkbeta.no/feed/',
  'https://feeds.arstechnica.com/arstechnica/index/'
];

// Always use AllOrigins to bypass CORS (no setup, best-effort reliability)
const PROXY = 'https://api.allorigins.win/raw?url=';

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

function extractItems(xml, max = 10) {
  const items = Array.from(xml.querySelectorAll('item, entry')).slice(0, max);
  const feedTitle = xml.querySelector('channel > title, feed > title')?.textContent?.trim() || '';
  return items.map(node => {
    const title = node.querySelector('title')?.textContent?.trim() || 'Untitled';
    const linkEl = node.querySelector('link');
    const href = (linkEl?.getAttribute?.('href')) || (linkEl?.textContent) || '#';
    const link = href && href.startsWith('http') ? href : href?.replace(/^\/+/, 'https://') || '#';
    const pub = node.querySelector('pubDate, updated, published')?.textContent || '';
    const sourceTitle = feedTitle || (link && link !== '#' ? new URL(link, location.href).hostname : 'Feed');
    const desc = node.querySelector('description, summary, content')?.textContent || '';
    return { title, link, pub, sourceTitle, desc };
  });
}

function renderArticles(allItems) {
  const grid = document.getElementById('articles');
  grid.innerHTML = '';
  allItems.forEach(item => {
    const card = document.createElement('article');
    card.className = 'card';
    const dateStr = item.pub ? new Date(item.pub).toLocaleString() : '';
    const short = item.desc ? item.desc.replace(/<[^>]*>/g, '').slice(0, 200) : '';
    card.innerHTML = `
      <h3><a href="${item.link}" target="_blank" rel="noopener noreferrer">${item.title}</a></h3>
      <div class="meta"><span class="source">${item.sourceTitle}</span>${dateStr ? ' · <span>' + dateStr + '</span>' : ''}</div>
      ${short ? '<div>' + short + '…</div>' : ''}
    `;
    grid.appendChild(card);
  });
}

async function refresh() {
  const status = document.getElementById('status');
  const grid = document.getElementById('articles');
  grid.innerHTML = '';
  status.textContent = 'Loading feeds…';

  const results = await Promise.allSettled(
    FEEDS.map(async (url) => {
      try {
        const xml = await fetchFeed(url);
        const items = extractItems(xml, 8);
        return items;
      } catch (e) {
        return { error: true, url, e };
      }
    })
  );

  const okItems = [];
  const errors = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && !r.value?.error) {
      okItems.push(...r.value);
    } else {
      errors.push(FEEDS[i]);
      // Optional: console.warn('Feed failed', FEEDS[i], r.reason || r.value?.e);
    }
  });

  okItems.sort((a, b) => (Date.parse(b.pub || '') || 0) - (Date.parse(a.pub || '') || 0));
  renderArticles(okItems);

  status.innerHTML = errors.length
    ? '<span class="error">Some feeds failed to load:</span> ' + errors.map(u => { try { return new URL(u).hostname; } catch { return u; } }).join(', ')
    : 'All feeds loaded.';

  setUpdatedStamp();
}

// Wire up once DOM is ready (defer attribute ensures this runs after HTML)
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('refreshBtn')?.addEventListener('click', refresh);
  refresh();
});
