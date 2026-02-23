const ids = [571970, 691777];
const groups = ['hitting', 'pitching'];

async function maxSeason(id, group) {
  const url = `https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=yearByYear&group=${group}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const d = await r.json();
  const splits = Array.isArray(d?.stats?.[0]?.splits) ? d.stats[0].splits : [];
  const seasons = splits.map((s) => Number.parseInt(String(s?.season || ''), 10)).filter((n) => Number.isInteger(n));
  return seasons.length ? Math.max(...seasons) : null;
}

(async () => {
  for (const id of ids) {
    const out = {};
    for (const g of groups) out[g] = await maxSeason(id, g);
    const max = Math.max(out.hitting || 0, out.pitching || 0) || null;
    console.log(JSON.stringify({ id, ...out, max }));
  }
})();
