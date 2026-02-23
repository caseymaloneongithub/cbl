(async () => {
  const u = 'https://statsapi.mlb.com/api/v1/stats?stats=season&group=hitting&season=2025&playerPool=ALL&sportIds=14&limit=100&offset=0&hydrate=person';
  const r = await fetch(u);
  const d = await r.json();
  const s = (d && d.stats && d.stats[0]) || {};
  console.log(JSON.stringify({
    ok: r.ok,
    status: r.status,
    totalSplits: s.totalSplits,
    totalResults: s.totalResults,
    splitsLen: Array.isArray(s.splits) ? s.splits.length : null,
    firstSeason: s.splits && s.splits[0] ? s.splits[0].season : null
  }, null, 2));
})();
