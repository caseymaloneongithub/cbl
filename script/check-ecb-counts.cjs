const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const teamRows = await pool.query(`
    select lm.league_id, lm.user_id, lm.team_name, lm.team_abbreviation
    from league_members lm
    where upper(lm.team_abbreviation) = 'ECB' and coalesce(lm.is_archived,false)=false
    order by lm.league_id
  `);
  console.log('TEAM_ROWS');
  console.log(JSON.stringify(teamRows.rows, null, 2));

  const countRows = await pool.query(`
    select lra.league_id, lra.season, lra.roster_type, count(*)::int as count
    from league_roster_assignments lra
    join league_members lm
      on lm.user_id = lra.user_id
     and lm.league_id = lra.league_id
    where upper(lm.team_abbreviation) = 'ECB'
      and coalesce(lm.is_archived,false)=false
    group by lra.league_id, lra.season, lra.roster_type
    order by lra.league_id, lra.season, lra.roster_type
  `);
  console.log('DB_COUNTS');
  console.log(JSON.stringify(countRows.rows, null, 2));

  await pool.end();
})().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
