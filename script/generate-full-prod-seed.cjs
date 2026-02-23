const fs = require("fs");
const path = require("path");

const inputPath = process.argv[2] || "cbl_database_dump.sql";
const outputPath = process.argv[3] || path.join("script", "sql", "seed-full-prod.sql");

const raw = fs.readFileSync(inputPath, "utf8");
const setvalRegex = /^SELECT pg_catalog\.setval\(.+?;\s*$/gm;

const copyBlocks = [];
const linesIn = raw.split(/\r?\n/);
for (let i = 0; i < linesIn.length; i++) {
  const line = linesIn[i];
  const m = line.match(/^COPY public\.([a-z_]+) \(([^)]+)\) FROM stdin;$/);
  if (!m) continue;

  const table = m[1];
  const columns = m[2];
  const dataLines = [];
  i += 1;
  while (i < linesIn.length && linesIn[i] !== "\\.") {
    dataLines.push(linesIn[i]);
    i += 1;
  }

  copyBlocks.push({
    table,
    columns,
    data: dataLines.join("\n"),
  });
}

if (copyBlocks.length === 0) {
  throw new Error("No COPY blocks found in dump.");
}

const setvals = (raw.match(setvalRegex) || []).filter((s) => s.includes("'public."));
const tables = Array.from(new Set(copyBlocks.map((b) => b.table)));

const lines = [];
lines.push("-- Auto-generated from cbl_database_dump.sql");
lines.push("-- Applies full prod-like data to current migrated schema.");
lines.push("BEGIN;");
lines.push("SET LOCAL session_replication_role = replica;");
lines.push("TRUNCATE TABLE " + tables.map((t) => `public.${t}`).join(", ") + " RESTART IDENTITY CASCADE;");
lines.push("");
lines.push("-- Legacy compatibility staging for draft_picks (old pick_number schema)");
lines.push("CREATE TEMP TABLE legacy_draft_picks (");
lines.push("  id integer,");
lines.push("  draft_id integer,");
lines.push("  round integer,");
lines.push("  pick_number integer,");
lines.push("  user_id varchar,");
lines.push("  mlb_player_id integer,");
lines.push("  roster_type varchar(10),");
lines.push("  created_at timestamp");
lines.push(");");
lines.push("");

for (const block of copyBlocks) {
  if (block.table === "draft_picks") {
    lines.push("COPY legacy_draft_picks (id, draft_id, round, pick_number, user_id, mlb_player_id, roster_type, created_at) FROM stdin;");
    if (block.data.length > 0) lines.push(block.data);
    lines.push("\\.");
    lines.push("");
    continue;
  }

  lines.push(`COPY public.${block.table} (${block.columns}) FROM stdin;`);
  if (block.data.length > 0) lines.push(block.data);
  lines.push("\\.");
  lines.push("");
}

lines.push("-- Map legacy draft picks into current slot-based draft_picks schema");
lines.push("INSERT INTO public.draft_picks (");
lines.push("  id, draft_id, round, round_pick_index, user_id, mlb_player_id, roster_type, created_at,");
lines.push("  overall_pick_number, selected_org_name, selected_org_id, selected_org_player_ids,");
lines.push("  scheduled_at, deadline_at, made_at, made_by_user_id");
lines.push(")");
lines.push("OVERRIDING SYSTEM VALUE");
lines.push("SELECT");
lines.push("  lp.id,");
lines.push("  lp.draft_id,");
lines.push("  lp.round,");
lines.push("  row_number() OVER (PARTITION BY lp.draft_id, lp.round ORDER BY lp.pick_number, lp.id) - 1 AS round_pick_index,");
lines.push("  lp.user_id,");
lines.push("  lp.mlb_player_id,");
lines.push("  lp.roster_type,");
lines.push("  lp.created_at,");
lines.push("  lp.pick_number AS overall_pick_number,");
lines.push("  NULL::varchar(255) AS selected_org_name,");
lines.push("  NULL::integer AS selected_org_id,");
lines.push("  '[]'::jsonb AS selected_org_player_ids,");
lines.push("  COALESCE(lp.created_at::timestamptz, now()) AS scheduled_at,");
lines.push("  COALESCE(lp.created_at::timestamptz, now()) + interval '30 minutes' AS deadline_at,");
lines.push("  lp.created_at::timestamptz AS made_at,");
lines.push("  lp.user_id AS made_by_user_id");
lines.push("FROM legacy_draft_picks lp");
lines.push("ORDER BY lp.id;");
lines.push("");

if (setvals.length) {
  lines.push("-- Preserve sequence counters from dump");
  for (const s of setvals) lines.push(s.trim());
  lines.push("");
}

lines.push("COMMIT;");
lines.push("");

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, lines.join("\n"));
console.log(`Wrote ${outputPath}`);
console.log(`COPY blocks: ${copyBlocks.length}, setval statements: ${setvals.length}`);
