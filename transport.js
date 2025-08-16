// === Config ===
const ENTUR_URL = 'https://api.entur.io/journey-planner/v3/graphql';
const ET_CLIENT_NAME = 'yourdomain-no-pages'; // set your own identifier (raises rate limits)

// NSR StopPlace IDs
const STOPS = {
  // Wergeland (Line 1)
  wergeland: 'NSR:StopPlace:60731', // source: Entur map page
  // Byparken (city centre)
  byparken: 'NSR:StopPlace:30859'   // source: Wikidata NSR id
};

// How many upcoming departures to show per list
const LIMIT_PER_LIST = 8; // tweak as you like

// === Date helpers (DD.MM.YYYY, HH.MM.SS) ===
const pad2 = n => String(n).padStart(2, '0');
function formatEU(dt) {
  const d = pad2(dt.getDate()), m = pad2(dt.getMonth()+1), y = dt.getFullYear();
  const hh = pad2(dt.getHours()), mm = pad2(dt.getMinutes()), ss = pad2(dt.getSeconds());
  return `${d}.${m}.${y}, ${hh}.${mm}.${ss}`;
}
function minutesFromNow(iso) {
  const t = Date.parse(iso || '');
  if (isNaN(t)) return '';
  const diff = Math.round((t - Date.now()) / 60000);
  return diff <= 0 ? 'now' : `${diff} min`;
}

// === GraphQL ===
function gqlForStop(stopId) {
  // estimatedCalls → real-time if available (expected*), falls back to aimed* otherwise.
  // We ask for line/publicCode + destination + expectedDepartureTime.
  return `
  {
    stopPlace(id: "${stopId}") {
      name
      estimatedCalls(timeRange: 7200, numberOfDepartures: 50) {
        realtime
        expectedDepartureTime
        aimedDepartureTime
        destinationDisplay { frontText }
        serviceJourney {
          journeyPattern {
            line { publicCode transportMode name }
          }
        }
        quay { name }
      }
    }
  }`;
}

async function fetchDepartures(stopId) {
  const res = await fetch(ENTUR_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ET-Client-Name': ET_CLIENT_NAME
    },
    body: JSON.stringify({ query: gqlForStop(stopId) })
  });
  if (!res.ok) throw new Error(`Entur ${res.status}`);
  const data = await res.json();
  return data?.data?.stopPlace?.estimatedCalls || [];
}

// Normalize + filter to Bybanen trams only (transportMode === "tram")
function normalizeCalls(calls) {
  return calls
    .filter(c => (c.serviceJourney?.journeyPattern?.line?.transportMode || '').toLowerCase() === 'tram')
    .map(c => {
      const line = c.serviceJourney.journeyPattern.line.publicCode || '';
      const dest = c.destinationDisplay?.frontText || '';
      const when = c.expectedDepartureTime || c.aimedDepartureTime;
      const quay = c.quay?.name || '';
      return { line, dest, when, quay };
    });
}

// Render helpers
function renderRows(rootId, items) {
  const root = document.getElementById(rootId);
  root.innerHTML = '';
  if (!items.length) {
    root.innerHTML = '<div class="row"><span class="dest">No departures</span></div>';
    return;
  }
  items.slice(0, LIMIT_PER_LIST).forEach(it => {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <span class="line">${it.line}</span>
      <span class="dest">${it.dest}${it.quay ? ` <span class="meta">(${it.quay})</span>` : ''}</span>
      <span class="when">${minutesFromNow(it.when)}</span>
    `;
    root.appendChild(row);
  });
}

function setUpdatedStamp() {
  const el = document.getElementById('updated');
  if (!el) return;
  el.textContent = `Updated: ${formatEU(new Date())}`;
}

// Main refresh
async function refresh() {
  const status = document.getElementById('status');
  status.textContent = 'Loading…';

  try {
    // --- Wergeland ---
    const wCalls = normalizeCalls(await fetchDepartures(STOPS.wergeland));

// Robust split: anything explicitly to Airport → airport; everything else → Byparken
const isAirport = /(lufthavn|flesland)/i;
const towardsAirport  = wCalls.filter(c => isAirport.test(c.dest));
const towardsByparken = wCalls.filter(c => !isAirport.test(c.dest));

renderRows('wergeland-to-byparken', towardsByparken);
renderRows('wergeland-to-airport',  towardsAirport);

    // --- Byparken (all Bybanen departures) ---
    const bCalls = normalizeCalls(await fetchDepartures(STOPS.byparken));
    renderRows('byparken-rows', bCalls);

    status.textContent = 'Live from Entur.';
    setUpdatedStamp();
  } catch (e) {
    console.error(e);
    status.innerHTML = '<span class="error">Failed to load live departures.</span>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('refreshBtn')?.addEventListener('click', refresh);
  refresh();
});