const normalizeName = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const normalizeNameWithSpaces = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const splitNormName = (value) => {
  const parts = normalizeNameWithSpaces(value).split(/\s+/).filter(Boolean);
  return { first: parts[0] || '', last: parts.length ? parts[parts.length - 1] : '', full: parts.join(' ') };
};
const levenshtein = (aRaw, bRaw) => {
  const a = String(aRaw || ''); const b = String(bRaw || ''); const m = a.length; const n = b.length;
  if (m === 0) return n; if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
};

(async () => {
  const rawName = 'Darneivi Tineo';
  const season = 2025;
  const SPORT_IDS_FOR_DIRECTORY = [11,12,13,14,16];
  const candidates = [];
  for (const y of [season, season-1, season-2, season-3, season-4]) {
    for (const sportId of SPORT_IDS_FOR_DIRECTORY) {
      const r = await fetch(`https://statsapi.mlb.com/api/v1/sports/${sportId}/players?season=${y}`);
      if (!r.ok) continue;
      const j = await r.json();
      for (const p of j.people || []) {
        const fullName = String(p.fullName || '').trim();
        if (!fullName) continue;
        const candSplit = splitNormName(fullName);
        const rowSplit = splitNormName(rawName);
        const lastDist = levenshtein(rowSplit.last, candSplit.last);
        if (lastDist <= 1 || candSplit.last === rowSplit.last) {
          candidates.push({ mlbId: Number(p.id), fullName, season:y, currentTeamName: p.currentTeam?.name || null });
        }
      }
    }
  }
  const dedup = Array.from(new Map(candidates.map(c=>[c.mlbId,c])).values());
  const rowSplit = splitNormName(rawName);
  const ranked = dedup.map((p)=>{
    let score = 40;
    const candSplit = splitNormName(p.fullName);
    const firstDist = levenshtein(rowSplit.first, candSplit.first);
    if (firstDist <= 1) score = Math.max(score,78);
    else if (firstDist <=2) score = Math.max(score,68);
    const fullDist = levenshtein(rowSplit.full, candSplit.full);
    if (fullDist <=2) score = Math.max(score,74);
    else if (fullDist <=3) score = Math.max(score,62);
    return { ...p, score, firstDist, fullDist };
  }).sort((a,b)=>b.score-a.score).slice(0,5);
  const top = ranked[0]; const second = ranked[1];
  const topSplit = top ? splitNormName(top.fullName) : null;
  const topLooksLikeSingleTypo = !!top && !!topSplit && !!rowSplit.last && topSplit.last===rowSplit.last && !!rowSplit.first && !!topSplit.first && levenshtein(rowSplit.first, topSplit.first)<=2 && (!second || (top.score-second.score)>=12) && top.score>=65;
  console.log({rowSplit, top, second, topLooksLikeSingleTypo});
})();
