async function main() {
  const playerId = process.argv[2] || "660271";
  const url = `https://statsapi.mlb.com/api/v1/people/${playerId}`;
  const res = await fetch(url);
  const data = await res.json();
  const p = data?.people?.[0] || {};
  const keys = Object.keys(p).filter((k) => k.toLowerCase().includes("name")).sort();
  console.log(keys.join(","));
  console.log(`middleName=${p.middleName ?? "<missing>"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
