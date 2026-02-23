$baseUrl = if ($env:DRAFT_TEST_BASE_URL) { $env:DRAFT_TEST_BASE_URL } else { "http://localhost:5001" }
$csvPath = if ($env:DRAFT_CSV_PATH) { $env:DRAFT_CSV_PATH } else { "C:\Users\casey\OneDrive\2026_draft.csv" }
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
    @{ abbr = "ARI"; name = "Arizona Diamondbacks" }
    @{ abbr = "ATL"; name = "Atlanta Braves" }
    @{ abbr = "BAL"; name = "Baltimore Orioles" }
    @{ abbr = "BOS"; name = "Boston Red Sox" }
    @{ abbr = "CHC"; name = "Chicago Cubs" }
    @{ abbr = "CWS"; name = "Chicago White Sox" }
    @{ abbr = "CIN"; name = "Cincinnati Reds" }
    @{ abbr = "CLE"; name = "Cleveland Guardians" }
    @{ abbr = "COL"; name = "Colorado Rockies" }
    @{ abbr = "DET"; name = "Detroit Tigers" }
    @{ abbr = "HOU"; name = "Houston Astros" }
    @{ abbr = "KC1"; name = "Kansas City Royals" }
    @{ abbr = "LAA"; name = "Los Angeles Angels" }
    @{ abbr = "LAD"; name = "Los Angeles Dodgers" }
    @{ abbr = "MIA"; name = "Miami Marlins" }
    @{ abbr = "MIL"; name = "Milwaukee Brewers" }
    @{ abbr = "MIN"; name = "Minnesota Twins" }
    @{ abbr = "NYM"; name = "New York Mets" }
    @{ abbr = "NYY"; name = "New York Yankees" }
    @{ abbr = "ATH"; name = "Athletics" }
    @{ abbr = "PHI"; name = "Philadelphia Phillies" }
    @{ abbr = "PIT"; name = "Pittsburgh Pirates" }
    @{ abbr = "SDP"; name = "San Diego Padres" }
    @{ abbr = "SFG"; name = "San Francisco Giants" }
    @{ abbr = "SEA"; name = "Seattle Mariners" }
    @{ abbr = "STL"; name = "St. Louis Cardinals" }
    @{ abbr = "TBR"; name = "Tampa Bay Rays" }
    @{ abbr = "TEX"; name = "Texas Rangers" }
    @{ abbr = "TOR"; name = "Toronto Blue Jays" }
    @{ abbr = "WSN"; name = "Washington Nationals" }
  )
}

try {
  Add-Result -Step "start" -Status "PASS" -Detail "Running 30-team/6-round CSV draft test against $baseUrl using $csvPath"
  Assert-True (Test-Path $csvPath) "Draft CSV not found: $csvPath"

  $csvRows = Import-Csv -Path $csvPath
  Assert-True ($csvRows.Count -gt 0) "CSV has no data rows"
  $ids = New-Object System.Collections.Generic.List[int]
  foreach ($r in $csvRows) {
    $raw = [string]$r."Player ID"
    if (-not $raw) { continue }
    $n = 0
    if ([int]::TryParse($raw.Trim(), [ref]$n) -and $n -gt 0) { $ids.Add($n) }
  }
  $uniqueIds = @($ids | Select-Object -Unique)
  Assert-True ($uniqueIds.Count -ge 180) "Need at least 180 valid unique Player ID values, found $($uniqueIds.Count)"
  Add-Result -Step "parse-csv" -Status "PASS" -Detail "rows=$($csvRows.Count) validUniquePlayerIds=$($uniqueIds.Count)"

  $admin = Login -Email "admin@test.local" -Password "TestPass123!"
  Add-Result -Step "login-admin" -Status "PASS" -Detail "adminId=$($admin.userId)"

  $teams = Build-TeamData
  $suffix = Get-Date -Format "yyyyMMddHHmmss"
  $leagueSlug = "csv-draft-30x6-$suffix"
  $leagueResp = Invoke-Api -Method "POST" -Path "/api/leagues" -Session $admin.session -Body @{
    name = "CSV Draft 30x6 $suffix"
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
      email = "csv-$suffix-owner$n@test.local"
      firstName = "CSV"
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
  Add-Result -Step "create-30-teams" -Status "PASS" -Detail "30 owners created and added to this league"

  $draftResp = Invoke-Api -Method "POST" -Path "/api/drafts" -Session $admin.session -Body @{
    name = "CSV Draft 30x6 $suffix"
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

  $chunks = 0
  for ($i = 0; $i -lt $uniqueIds.Count; $i += 200) {
    $chunk = @($uniqueIds[$i..([Math]::Min($i + 199, $uniqueIds.Count - 1))])
    $uploadResp = Invoke-Api -Method "POST" -Path "/api/drafts/$draftId/players/upload" -Session $admin.session -Body @{ mlbIds = $chunk }
    Assert-True ($uploadResp.status -eq 200) "Upload chunk failed at index ${i}: status=$($uploadResp.status) body=$($uploadResp.raw)"
    $chunks++
  }
  Add-Result -Step "upload-csv-player-ids" -Status "PASS" -Detail "Uploaded $($uniqueIds.Count) IDs in $chunks chunks"

  $playersResp = Invoke-Api -Method "GET" -Path "/api/drafts/$draftId/players" -Session $admin.session
  Assert-True ($playersResp.status -eq 200) "Fetch draft players failed"
  $poolCount = @($playersResp.json).Count
  Assert-True ($poolCount -ge 180) "Need >= 180 players in draft pool after upload; got $poolCount"
  Add-Result -Step "validate-player-pool" -Status "PASS" -Detail "draftPoolPlayers=$poolCount"

  $abbrs = @($teams | ForEach-Object { $_.abbr })
  $r1 = @($abbrs)
  $r2 = @($abbrs); [array]::Reverse($r2)
  $r3 = @($abbrs)
  $r4 = @($abbrs); [array]::Reverse($r4)
  $r5 = @($abbrs)
  $r6 = @($abbrs); [array]::Reverse($r6)
  $orderMatrix = @($r1, $r2, $r3, $r4, $r5, $r6)

  $csvLines = New-Object System.Collections.Generic.List[string]
  $csvLines.Add("Round 1,Round 2,Round 3,Round 4,Round 5,Round 6")
  for ($row = 0; $row -lt 30; $row++) {
    $csvLines.Add(("{0},{1},{2},{3},{4},{5}" -f $orderMatrix[0][$row], $orderMatrix[1][$row], $orderMatrix[2][$row], $orderMatrix[3][$row], $orderMatrix[4][$row], $orderMatrix[5][$row]))
  }
  $orderCsv = [string]::Join("`n", $csvLines)
  $orderResp = Invoke-Api -Method "POST" -Path "/api/drafts/$draftId/order/upload-csv" -Session $admin.session -Body @{ csvData = $orderCsv }
  Assert-True ($orderResp.status -eq 200) "Order CSV upload failed: status=$($orderResp.status) body=$($orderResp.raw)"
  Add-Result -Step "upload-6-round-order" -Status "PASS" -Detail "totalEntries=$($orderResp.json.totalEntries)"

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
  Add-Result -Step "configure-rounds" -Status "PASS" -Detail "Rounds 1-5 regular, Round 6 team draft"

  $startResp = Invoke-Api -Method "POST" -Path "/api/drafts/$draftId/start" -Session $admin.session
  Assert-True ($startResp.status -eq 200) "Start draft failed: status=$($startResp.status) body=$($startResp.raw)"
  Add-Result -Step "start-draft" -Status "PASS" -Detail "status=$($startResp.json.status)"

  $ordersByRound = @{}
  for ($r = 1; $r -le 6; $r++) {
    $oResp = Invoke-Api -Method "GET" -Path "/api/drafts/$draftId/order?roundNumber=$r" -Session $admin.session
    Assert-True ($oResp.status -eq 200) "Fetch order round $r failed"
    $ordersByRound[$r] = @($oResp.json | Sort-Object { [int]$_.order.orderIndex })
    Assert-True ($ordersByRound[$r].Count -eq 30) "Expected 30 picks in round $r"
  }

  $availableResp = Invoke-Api -Method "GET" -Path "/api/drafts/$draftId/players?status=available" -Session $admin.session
  Assert-True ($availableResp.status -eq 200) "Fetch available players failed"
  $available = @($availableResp.json | Sort-Object { [int]$_.mlbPlayerId })
  Assert-True ($available.Count -ge 180) "Need >= 180 available players to run draft, got $($available.Count)"

  $pickCursor = 0
  for ($r = 1; $r -le 5; $r++) {
    foreach ($entry in $ordersByRound[$r]) {
      $selected = $available[$pickCursor]
      $pickCursor++
      $pickResp = Invoke-Api -Method "POST" -Path "/api/drafts/$draftId/commissioner-pick" -Session $admin.session -Body @{
        userId = [string]$entry.user.id
        mlbPlayerId = [int]$selected.mlbPlayerId
        rosterType = "milb"
      }
      Assert-True ($pickResp.status -eq 201) "Commissioner pick failed (r$r): status=$($pickResp.status) body=$($pickResp.raw)"
    }
  }
  Add-Result -Step "simulate-rounds-1-5" -Status "PASS" -Detail "Completed 150 regular commissioner picks, rosterType=milb"

  $remainingForTeamResp = Invoke-Api -Method "GET" -Path "/api/drafts/$draftId/players?status=available" -Session $admin.session
  Assert-True ($remainingForTeamResp.status -eq 200) "Fetch remaining players before team draft failed"
  $orgRows = @($remainingForTeamResp.json | Where-Object { $_.player.parentOrgName } | Group-Object { [string]$_.player.parentOrgName } | Sort-Object Name)
  Assert-True ($orgRows.Count -ge 30) "Need at least 30 organizations available for round-6 team draft, got $($orgRows.Count)"

  $orgSelection = @($orgRows | Select-Object -First 30 | ForEach-Object { [string]$_.Name })
  for ($i = 0; $i -lt 30; $i++) {
    $entry = $ordersByRound[6][$i]
    $orgName = $orgSelection[$i]
    $teamPickResp = Invoke-Api -Method "POST" -Path "/api/drafts/$draftId/commissioner-pick" -Session $admin.session -Body @{
      userId = [string]$entry.user.id
      selectedOrgName = $orgName
      rosterType = "milb"
    }
    Assert-True ($teamPickResp.status -eq 201) "Commissioner team pick failed (org=$orgName): status=$($teamPickResp.status) body=$($teamPickResp.raw)"
  }
  Add-Result -Step "simulate-round-6-team-draft" -Status "PASS" -Detail "Completed 30 organization picks in team-draft round"

  $picksResp = Invoke-Api -Method "GET" -Path "/api/drafts/$draftId/picks" -Session $admin.session
  Assert-True ($picksResp.status -eq 200) "Fetch picks failed"
  Assert-True ($picksResp.json.Count -eq 180) "Expected 180 pick slots, got $($picksResp.json.Count)"
  $unmade = @($picksResp.json | Where-Object { -not $_.madeAt }).Count
  Assert-True ($unmade -eq 0) "Expected 0 open picks, got $unmade"
  $nonMilb = @($picksResp.json | Where-Object { $_.rosterType -ne "milb" }).Count
  Assert-True ($nonMilb -eq 0) "Expected all picks assigned to milb, non-milb picks=$nonMilb"

  $draftFinalResp = Invoke-Api -Method "GET" -Path "/api/drafts/$draftId" -Session $admin.session
  Assert-True ($draftFinalResp.status -eq 200) "Fetch final draft failed"
  Assert-True ($draftFinalResp.json.status -eq "completed") "Expected completed draft, got $($draftFinalResp.json.status)"

  $assignResp = Invoke-Api -Method "GET" -Path "/api/leagues/$leagueId/roster-assignments?season=2026&rosterType=milb" -Session $admin.session
  Assert-True ($assignResp.status -eq 200) "Fetch roster assignments failed"
  $milbAssigned = @($assignResp.json.assignments).Count
  Assert-True ($milbAssigned -ge 180) "Expected at least 180 MiLB assignments from draft picks, got $milbAssigned"

  Add-Result -Step "validate-final-state" -Status "PASS" -Detail "draftStatus=completed picks=180 milbAssignments=$milbAssigned"
  Add-Result -Step "context" -Status "PASS" -Detail "leagueId=$leagueId draftId=$draftId csv=$csvPath"
  Add-Result -Step "overall" -Status "PASS" -Detail "30-team, 6-round draft run succeeded using provided CSV player IDs"
} catch {
  Add-Result -Step "overall" -Status "FAIL" -Detail $_.Exception.Message
} finally {
  $outDir = "attached_assets/draft-csv-30x6"
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  $outPath = Join-Path $outDir "results.json"
  $results | ConvertTo-Json -Depth 20 | Set-Content -Path $outPath
  Get-Content $outPath
}
