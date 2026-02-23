const seasons = [2021, 2022, 2023, 2024, 2025];
const sportIds = [11, 12, 13, 14, 15, 16, 17];

async function run() {
  const sportsResp = await fetch('https://statsapi.mlb.com/api/v1/sports');
  const sportsJson = await sportsResp.json();
  console.log('Sports:');
  for (const s of sportsJson.sports || []) {
    if (sportIds.includes(Number(s.id)) || [1].includes(Number(s.id))) {
      console.log(`${s.id} | ${s.code} | ${s.abbreviation} | ${s.name}`);
    }
  }

  const names = ['Dameivi Tineo', 'Darneivi Tineo', 'Tineo'];
  console.log('\npeople/search checks:');
  for (const n of names) {
    const r = await fetch(`https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(n)}`);
    const j = await r.json();
    const people = Array.isArray(j.people) ? j.people : [];
    console.log(`${n} => ${people.length}`);
    for (const p of people) {
      console.log(`  ${p.id} | ${p.fullName} | ${p.birthDate || ''} | ${p.currentTeam?.name || ''}`);
    }
  }

  console.log('\nDirectory checks (surname contains tineo):');
  for (const y of seasons) {
    for (const s of sportIds) {
      try {
        const r = await fetch(`https://statsapi.mlb.com/api/v1/sports/${s}/players?season=${y}`);
        if (!r.ok) continue;
        const j = await r.json();
        const people = Array.isArray(j.people) ? j.people : [];
        const m = people.filter((p) => /tineo/i.test(String(p.fullName || '')));
        if (m.length) {
          console.log(`season ${y} sport ${s} count ${m.length}`);
          for (const p of m) {
            console.log(`  ${p.id} | ${p.fullName} | ${p.currentTeam?.name || ''}`);
          }
        }
      } catch {}
    }
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
