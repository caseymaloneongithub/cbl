$ErrorActionPreference = "Stop"

$baseUrl = if ($env:DRAFT_TEST_BASE_URL) { $env:DRAFT_TEST_BASE_URL } else { "http://localhost:5001" }
$results = New-Object System.Collections.Generic.List[Object]

function Add-Result {
  param([string]$Step, [string]$Status, [string]$Detail)
  $results.Add([pscustomobject]@{
    step = $Step
    status = $Status
    detail = $Detail
    at = (Get-Date).ToString("o")
  })
}

function Invoke-Api {
  param(
    [string]$Method,
    [string]$Path,
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session,
    [object]$Body = $null
  )

  $uri = "$baseUrl$Path"
  $params = @{
    Uri = $uri
    Method = $Method
    UseBasicParsing = $true
    WebSession = $Session
  }
  if ($null -ne $Body) {
    $params["ContentType"] = "application/json"
    $params["Body"] = ($Body | ConvertTo-Json -Depth 20)
  }

  try {
    $resp = Invoke-WebRequest @params
    $json = $null
    if ($resp.Content -and $resp.Content.Trim().Length -gt 0) {
      try { $json = $resp.Content | ConvertFrom-Json } catch { $json = $null }
    }
    [pscustomobject]@{ ok = $true; status = [int]$resp.StatusCode; json = $json; raw = $resp.Content }
  } catch {
    $webResp = $_.Exception.Response
    $status = 0
    $raw = ""
    if ($webResp) {
      $status = [int]$webResp.StatusCode.value__
      $reader = New-Object IO.StreamReader($webResp.GetResponseStream())
      $raw = $reader.ReadToEnd()
    } else {
      $raw = $_.Exception.Message
    }
    $json = $null
    if ($raw -and $raw.Trim().Length -gt 0) {
      try { $json = $raw | ConvertFrom-Json } catch { $json = $null }
    }
    [pscustomobject]@{ ok = $false; status = $status; json = $json; raw = $raw }
  }
}

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Login {
  param([string]$Email, [string]$Password)
  $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $resp = Invoke-Api -Method "POST" -Path "/api/auth/login" -Session $session -Body @{ email = $Email; password = $Password }
  Assert-True ($resp.status -eq 200) "Login failed for ${Email}: status=$($resp.status) body=$($resp.raw)"
  [pscustomobject]@{
    session = $session
    userId = [string]$resp.json.id
    email = $Email
  }
}

function Build-TeamData {
  @(
    @{ abbr = "ARI"; name = "Arizona Diamondbacks"; teamId = 109; orgId = 109 }
    @{ abbr = "ATL"; name = "Atlanta Braves"; teamId = 144; orgId = 144 }
    @{ abbr = "BAL"; name = "Baltimore Orioles"; teamId = 110; orgId = 110 }
    @{ abbr = "BOS"; name = "Boston Red Sox"; teamId = 111; orgId = 111 }
    @{ abbr = "CHC"; name = "Chicago Cubs"; teamId = 112; orgId = 112 }
    @{ abbr = "CWS"; name = "Chicago White Sox"; teamId = 145; orgId = 145 }
    @{ abbr = "CIN"; name = "Cincinnati Reds"; teamId = 113; orgId = 113 }
    @{ abbr = "CLE"; name = "Cleveland Guardians"; teamId = 114; orgId = 114 }
    @{ abbr = "COL"; name = "Colorado Rockies"; teamId = 115; orgId = 115 }
    @{ abbr = "DET"; name = "Detroit Tigers"; teamId = 116; orgId = 116 }
    @{ abbr = "HOU"; name = "Houston Astros"; teamId = 117; orgId = 117 }
    @{ abbr = "KC1"; name = "Kansas City Royals"; teamId = 118; orgId = 118 }
    @{ abbr = "LAA"; name = "Los Angeles Angels"; teamId = 108; orgId = 108 }
    @{ abbr = "LAD"; name = "Los Angeles Dodgers"; teamId = 119; orgId = 119 }
    @{ abbr = "MIA"; name = "Miami Marlins"; teamId = 146; orgId = 146 }
    @{ abbr = "MIL"; name = "Milwaukee Brewers"; teamId = 158; orgId = 158 }
    @{ abbr = "MIN"; name = "Minnesota Twins"; teamId = 142; orgId = 142 }
    @{ abbr = "NYM"; name = "New York Mets"; teamId = 121; orgId = 121 }
    @{ abbr = "NYY"; name = "New York Yankees"; teamId = 147; orgId = 147 }
    @{ abbr = "ATH"; name = "Athletics"; teamId = 133; orgId = 133 }
    @{ abbr = "PHI"; name = "Philadelphia Phillies"; teamId = 143; orgId = 143 }
    @{ abbr = "PIT"; name = "Pittsburgh Pirates"; teamId = 134; orgId = 134 }
    @{ abbr = "SDP"; name = "San Diego Padres"; teamId = 135; orgId = 135 }
    @{ abbr = "SFG"; name = "San Francisco Giants"; teamId = 137; orgId = 137 }
    @{ abbr = "SEA"; name = "Seattle Mariners"; teamId = 136; orgId = 136 }
    @{ abbr = "STL"; name = "St. Louis Cardinals"; teamId = 138; orgId = 138 }
    @{ abbr = "TBR"; name = "Tampa Bay Rays"; teamId = 139; orgId = 139 }
    @{ abbr = "TEX"; name = "Texas Rangers"; teamId = 140; orgId = 140 }
    @{ abbr = "TOR"; name = "Toronto Blue Jays"; teamId = 141; orgId = 141 }
    @{ abbr = "WSN"; name = "Washington Nationals"; teamId = 120; orgId = 120 }
  )
}

function Build-OrderMatrix {
  param([string[]]$Abbrs)
  $r1 = @($Abbrs)
  $r2 = @($Abbrs); [array]::Reverse($r2)
  $r3 = @($Abbrs)
  $r4 = @($Abbrs); [array]::Reverse($r4)
  $r5 = @($Abbrs)
  $r6 = @($Abbrs)
  @($r1, $r2, $r3, $r4, $r5, $r6)
}

try {
  Add-Result -Step "start" -Status "PASS" -Detail "Running 30-team/1000-player draft scale test against $baseUrl"

  $admin = Login -Email "admin@test.local" -Password "TestPass123!"
  Add-Result -Step "login-admin" -Status "PASS" -Detail "adminId=$($admin.userId)"

  $teams = Build-TeamData
  Assert-True ($teams.Count -eq 30) "Expected 30 MLB team definitions"

  $suffix = Get-Date -Format "yyyyMMddHHmmss"
  $leagueName = "Scale Draft 30x1000 $suffix"
  $leagueSlug = "scale-draft-30x1000-$suffix"

  $leagueResp = Invoke-Api -Method "POST" -Path "/api/leagues" -Session $admin.session -Body @{
    name = $leagueName
    slug = $leagueSlug
    timezone = "America/Chicago"
  }
  Assert-True ($leagueResp.status -eq 201) "Create league failed: status=$($leagueResp.status) body=$($leagueResp.raw)"
  $leagueId = [int]$leagueResp.json.id
  Add-Result -Step "create-league" -Status "PASS" -Detail "leagueId=$leagueId slug=$leagueSlug"

  $bulkUsers = @()
  for ($i = 0; $i -lt 30; $i++) {
    $n = "{0:D2}" -f ($i + 1)
    $t = $teams[$i]
    $bulkUsers += @{
      email = "scale-$suffix-owner$n@test.local"
      firstName = "Scale"
      lastName = "Owner$n-$suffix"
      teamName = $t.name
      teamAbbreviation = $t.abbr
      password = "TestPass123!"
    }
  }

  $bulkResp = Invoke-Api -Method "POST" -Path "/api/users/bulk" -Session $admin.session -Body @{
    users = $bulkUsers
    leagueId = $leagueId
  }
  Assert-True ($bulkResp.status -eq 200) "Bulk user create failed: status=$($bulkResp.status) body=$($bulkResp.raw)"
  $failedUsers = @($bulkResp.json.results | Where-Object { -not $_.success })
  Assert-True ($failedUsers.Count -eq 0) "Bulk user creation had failures: $($bulkResp.raw)"
  Add-Result -Step "create-30-teams" -Status "PASS" -Detail "30 unique per-run owners created and added to this league"

  $values = New-Object System.Collections.Generic.List[string]
  for ($i = 0; $i -lt 30; $i++) {
    $idx = $i + 1
    $t = $teams[$i]
    $nameEsc = $t.name.Replace("'", "''")
    $abbrEsc = $t.abbr.Replace("'", "''")
    $values.Add("($idx, '$abbrEsc', '$nameEsc', $($t.orgId), $($t.teamId))")
  }
  $teamValuesSql = [string]::Join(",`n      ", $values)
  $seedSql = @"
WITH teams(idx, abbr, org_name, org_id, team_id) AS (
  VALUES
      $teamValuesSql
),
nums AS (
  SELECT generate_series(1, 1000) AS n
)
INSERT INTO mlb_players (
  mlb_id,
  full_name,
  first_name,
  last_name,
  primary_position,
  position_name,
  position_type,
  current_team_id,
  current_team_name,
  parent_org_id,
  parent_org_name,
  sport_id,
  sport_level,
  season,
  is_active
)
SELECT
  980000 + n AS mlb_id,
  'Scale Player ' || n AS full_name,
  'Scale' AS first_name,
  'Player' || n AS last_name,
  CASE (n % 6)
    WHEN 0 THEN 'P'
    WHEN 1 THEN 'C'
    WHEN 2 THEN '1B'
    WHEN 3 THEN '2B'
    WHEN 4 THEN 'SS'
    ELSE 'OF'
  END AS primary_position,
  'Scale Position' AS position_name,
  CASE WHEN (n % 6) = 0 THEN 'Pitcher' ELSE 'Position Player' END AS position_type,
  t.team_id,
  t.org_name || ' MLB',
  t.org_id,
  t.org_name,
  1 AS sport_id,
  CASE (n % 4)
    WHEN 0 THEN 'AAA'
    WHEN 1 THEN 'AA'
    WHEN 2 THEN 'A+'
    ELSE 'A'
  END AS sport_level,
  2026 AS season,
  true AS is_active
FROM nums
JOIN teams t ON (((n - 1) % 30) + 1) = t.idx
ON CONFLICT (mlb_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  primary_position = EXCLUDED.primary_position,
  position_name = EXCLUDED.position_name,
  position_type = EXCLUDED.position_type,
  current_team_id = EXCLUDED.current_team_id,
  current_team_name = EXCLUDED.current_team_name,
  parent_org_id = EXCLUDED.parent_org_id,
  parent_org_name = EXCLUDED.parent_org_name,
  sport_id = EXCLUDED.sport_id,
  sport_level = EXCLUDED.sport_level,
  season = EXCLUDED.season,
  is_active = EXCLUDED.is_active;
"@
  $sqlPath = "attached_assets/draft-scale-30x1000/seed_players.sql"
  New-Item -ItemType Directory -Force -Path (Split-Path $sqlPath) | Out-Null
  Set-Content -Path $sqlPath -Value $seedSql
  Get-Content -Raw $sqlPath | docker compose -f docker-compose.dev.yml exec -T db psql -U postgres -d cbl | Out-Null
  Add-Result -Step "seed-1000-players" -Status "PASS" -Detail "Inserted/updated MLB IDs 980001-981000 across 30 real MLB orgs"

  $draftResp = Invoke-Api -Method "POST" -Path "/api/drafts" -Session $admin.session -Body @{
    name = "Scale Draft 30x1000 $suffix"
    leagueId = $leagueId
    season = 2026
    rounds = 6
    snake = $false
    pickDurationMinutes = 1
    teamDraftRound = 6
  }
  Assert-True ($draftResp.status -eq 201) "Create draft failed: status=$($draftResp.status) body=$($draftResp.raw)"
  $draftId = [int]$draftResp.json.id
  Add-Result -Step "create-draft" -Status "PASS" -Detail "draftId=$draftId"

  $allIds = 980001..981000
  $chunks = 0
  for ($i = 0; $i -lt $allIds.Count; $i += 200) {
    $chunk = @($allIds[$i..([Math]::Min($i + 199, $allIds.Count - 1))])
    $uploadResp = Invoke-Api -Method "POST" -Path "/api/drafts/$draftId/players/upload" -Session $admin.session -Body @{ mlbIds = $chunk }
    Assert-True ($uploadResp.status -eq 200) "Upload chunk failed at index ${i}: status=$($uploadResp.status) body=$($uploadResp.raw)"
    $chunks++
  }
  Add-Result -Step "upload-1000-mlb-api-ids" -Status "PASS" -Detail "Uploaded in $chunks chunks"

  $orderMatrix = Build-OrderMatrix -Abbrs @($teams | ForEach-Object { $_.abbr })
  $csvLines = New-Object System.Collections.Generic.List[string]
  $csvLines.Add("Round 1,Round 2,Round 3,Round 4,Round 5,Round 6")
  for ($row = 0; $row -lt 30; $row++) {
    $csvLines.Add(("{0},{1},{2},{3},{4},{5}" -f $orderMatrix[0][$row], $orderMatrix[1][$row], $orderMatrix[2][$row], $orderMatrix[3][$row], $orderMatrix[4][$row], $orderMatrix[5][$row]))
  }
  $csv = [string]::Join("`n", $csvLines)
  $orderResp = Invoke-Api -Method "POST" -Path "/api/drafts/$draftId/order/upload-csv" -Session $admin.session -Body @{ csvData = $csv }
  Assert-True ($orderResp.status -eq 200) "Order CSV upload failed: status=$($orderResp.status) body=$($orderResp.raw)"
  Add-Result -Step "upload-6-round-order" -Status "PASS" -Detail "Total entries=$($orderResp.json.totalEntries)"

  $roundsResp = Invoke-Api -Method "GET" -Path "/api/drafts/$draftId/rounds" -Session $admin.session
  Assert-True ($roundsResp.status -eq 200) "Fetch rounds failed"
  Assert-True ($roundsResp.json.Count -eq 6) "Expected 6 rounds"
  $roundNumber = 1
  foreach ($round in $roundsResp.json) {
    $startTime = (Get-Date).AddMinutes(-700 + ($roundNumber * 40)).ToString("yyyy-MM-ddTHH:mm:ss")
    $patchResp = Invoke-Api -Method "PATCH" -Path "/api/drafts/$draftId/rounds/$($round.id)" -Session $admin.session -Body @{
      startTime = $startTime
      isTeamDraft = ($roundNumber -eq 6)
      pickDurationMinutes = 1
    }
    Assert-True ($patchResp.status -eq 200) "Patch round $roundNumber failed: status=$($patchResp.status) body=$($patchResp.raw)"
    $roundNumber++
  }
  Add-Result -Step "configure-rounds" -Status "PASS" -Detail "Round 6 set as team draft"

  $startResp = Invoke-Api -Method "POST" -Path "/api/drafts/$draftId/start" -Session $admin.session
  Assert-True ($startResp.status -eq 200) "Start draft failed: status=$($startResp.status) body=$($startResp.raw)"
  Add-Result -Step "start-draft" -Status "PASS" -Detail "status=$($startResp.json.status)"

  $membersResp = Invoke-Api -Method "GET" -Path "/api/leagues/$leagueId/members" -Session $admin.session
  Assert-True ($membersResp.status -eq 200) "Fetch league members failed"
  $memberMap = @{}
  foreach ($m in $membersResp.json) {
    if ($m.teamAbbreviation) {
      $memberMap[[string]$m.teamAbbreviation] = [string]$m.userId
    }
  }
  foreach ($t in $teams) {
    Assert-True ($memberMap.ContainsKey($t.abbr)) "Missing member mapping for abbreviation $($t.abbr)"
  }
  Add-Result -Step "map-team-users" -Status "PASS" -Detail "Mapped 30 team abbreviations to user IDs"

  $playersResp = Invoke-Api -Method "GET" -Path "/api/drafts/$draftId/players" -Session $admin.session
  Assert-True ($playersResp.status -eq 200) "Fetch draft players failed"
  $playerRows = @($playersResp.json | Where-Object { $_.player.mlbId -ge 980001 -and $_.player.mlbId -le 981000 })
  Assert-True ($playerRows.Count -eq 1000) "Expected 1000 seeded players, got $($playerRows.Count)"
  $playerRows = @($playerRows | Sort-Object { [int]$_.player.mlbId })

  $orderByRound = @{}
  for ($r = 1; $r -le 6; $r++) {
    $oResp = Invoke-Api -Method "GET" -Path "/api/drafts/$draftId/order?roundNumber=$r" -Session $admin.session
    Assert-True ($oResp.status -eq 200) "Fetch order for round $r failed"
    $ordered = @($oResp.json | Sort-Object { [int]$_.order.orderIndex })
    Assert-True ($ordered.Count -eq 30) "Expected 30 picks for round $r, got $($ordered.Count)"
    $orderByRound[$r] = $ordered
  }
  Add-Result -Step "fetch-round-orders" -Status "PASS" -Detail "Round orders loaded for all 6 rounds"

  $pickCursor = 0
  for ($r = 1; $r -le 5; $r++) {
    foreach ($entry in $orderByRound[$r]) {
      $selected = $playerRows[$pickCursor]
      $pickCursor++
      $pickResp = Invoke-Api -Method "POST" -Path "/api/drafts/$draftId/commissioner-pick" -Session $admin.session -Body @{
        userId = [string]$entry.user.id
        mlbPlayerId = [int]$selected.mlbPlayerId
        rosterType = "milb"
      }
      Assert-True ($pickResp.status -eq 201) "Commissioner regular pick failed (round $r): status=$($pickResp.status) body=$($pickResp.raw)"
    }
  }
  Add-Result -Step "simulate-rounds-1-5" -Status "PASS" -Detail "Completed 150 regular picks"

  for ($i = 0; $i -lt 30; $i++) {
    $entry = $orderByRound[6][$i]
    $org = $teams[$i].name
    $teamPickResp = Invoke-Api -Method "POST" -Path "/api/drafts/$draftId/commissioner-pick" -Session $admin.session -Body @{
      userId = [string]$entry.user.id
      selectedOrgName = $org
      rosterType = "milb"
    }
    Assert-True ($teamPickResp.status -eq 201) "Commissioner team pick failed ($org): status=$($teamPickResp.status) body=$($teamPickResp.raw)"
  }
  Add-Result -Step "simulate-round-6-team-draft" -Status "PASS" -Detail "Completed 30 unique organization selections"

  $picksResp = Invoke-Api -Method "GET" -Path "/api/drafts/$draftId/picks" -Session $admin.session
  Assert-True ($picksResp.status -eq 200) "Fetch picks failed"
  Assert-True ($picksResp.json.Count -eq 180) "Expected 180 slots, got $($picksResp.json.Count)"
  $unmade = @($picksResp.json | Where-Object { -not $_.madeAt }).Count
  Assert-True ($unmade -eq 0) "Expected all 180 slots filled, open slots=$unmade"

  $draftRespFinal = Invoke-Api -Method "GET" -Path "/api/drafts/$draftId" -Session $admin.session
  Assert-True ($draftRespFinal.status -eq 200) "Fetch final draft failed"
  Assert-True ($draftRespFinal.json.status -eq "completed") "Expected completed draft, got $($draftRespFinal.json.status)"

  $remainingResp = Invoke-Api -Method "GET" -Path "/api/drafts/$draftId/players?status=available" -Session $admin.session
  Assert-True ($remainingResp.status -eq 200) "Fetch remaining players failed"
  Assert-True (@($remainingResp.json).Count -eq 0) "Expected 0 available players after full draft, got $(@($remainingResp.json).Count)"

  Add-Result -Step "validate-final-state" -Status "PASS" -Detail "Draft completed with 180 picks and 0 available players"
  Add-Result -Step "context" -Status "PASS" -Detail "leagueId=$leagueId draftId=$draftId slug=$leagueSlug"
  Add-Result -Step "overall" -Status "PASS" -Detail "30-team, 1000-player, 6-round (last team-draft) scenario succeeded with league-scoped execution"
} catch {
  Add-Result -Step "overall" -Status "FAIL" -Detail $_.Exception.Message
} finally {
  $outDir = "attached_assets/draft-scale-30x1000"
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  $outPath = Join-Path $outDir "results.json"
  $results | ConvertTo-Json -Depth 20 | Set-Content -Path $outPath
  Get-Content $outPath
}
