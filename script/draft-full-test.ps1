$ErrorActionPreference = "Stop"

$baseUrl = if ($env:DRAFT_TEST_BASE_URL) { $env:DRAFT_TEST_BASE_URL } else { "http://localhost:5001" }
$results = New-Object System.Collections.Generic.List[Object]

function Add-Result {
  param(
    [string]$Step,
    [string]$Status,
    [string]$Detail
  )
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
    $params["Body"] = ($Body | ConvertTo-Json -Depth 10)
  }

  try {
    $resp = Invoke-WebRequest @params
    $json = $null
    if ($resp.Content -and $resp.Content.Trim().Length -gt 0) {
      try { $json = $resp.Content | ConvertFrom-Json } catch { $json = $null }
    }
    return [pscustomobject]@{
      ok = $true
      status = [int]$resp.StatusCode
      json = $json
      raw = $resp.Content
    }
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
    return [pscustomobject]@{
      ok = $false
      status = $status
      json = $json
      raw = $raw
    }
  }
}

function Assert-True {
  param(
    [bool]$Condition,
    [string]$Message
  )
  if (-not $Condition) {
    throw $Message
  }
}

function Login {
  param(
    [string]$Email,
    [string]$Password
  )
  $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $resp = Invoke-Api -Method "POST" -Path "/api/auth/login" -Session $session -Body @{
    email = $Email
    password = $Password
  }
  Assert-True ($resp.status -eq 200) "Login failed for ${Email}: status=$($resp.status) body=$($resp.raw)"
  return [pscustomobject]@{
    session = $session
    userId = [string]$resp.json.id
    email = $Email
  }
}

try {
  Add-Result -Step "start" -Status "PASS" -Detail "Running full draft logic test against $baseUrl"

  $admin = Login -Email "admin@test.local" -Password "TestPass123!"
  $owner1 = Login -Email "owner1@test.local" -Password "TestPass123!"
  $owner2 = Login -Email "owner2@test.local" -Password "TestPass123!"
  Add-Result -Step "login-users" -Status "PASS" -Detail "Logged in admin + 2 owners"

  $suffix = Get-Date -Format "yyyyMMddHHmmss"
  $leagueName = "Draft Full Test $suffix"
  $leagueSlug = "draft-full-test-$suffix"

  $leagueResp = Invoke-Api -Method "POST" -Path "/api/leagues" -Session $admin.session -Body @{
    name = $leagueName
    slug = $leagueSlug
    timezone = "America/Chicago"
  }
  Assert-True ($leagueResp.status -eq 201) "League creation failed: status=$($leagueResp.status) body=$($leagueResp.raw)"
  $leagueId = [int]$leagueResp.json.id
  Add-Result -Step "create-league" -Status "PASS" -Detail "leagueId=$leagueId slug=$leagueSlug"

  $add1 = Invoke-Api -Method "POST" -Path "/api/leagues/$leagueId/members" -Session $admin.session -Body @{
    email = "owner1@test.local"
    role = "owner"
    teamName = "Team One"
    teamAbbreviation = "ONE"
  }
  Assert-True (($add1.status -eq 201) -or ($add1.status -eq 400 -and $add1.raw -like "*already a member*")) "Add owner1 failed: status=$($add1.status) body=$($add1.raw)"

  $add2 = Invoke-Api -Method "POST" -Path "/api/leagues/$leagueId/members" -Session $admin.session -Body @{
    email = "owner2@test.local"
    role = "owner"
    teamName = "Team Two"
    teamAbbreviation = "TWO"
  }
  Assert-True (($add2.status -eq 201) -or ($add2.status -eq 400 -and $add2.raw -like "*already a member*")) "Add owner2 failed: status=$($add2.status) body=$($add2.raw)"
  Add-Result -Step "add-league-members" -Status "PASS" -Detail "Owners added"

  $draftResp = Invoke-Api -Method "POST" -Path "/api/drafts" -Session $admin.session -Body @{
    name = "Full Draft Test $suffix"
    leagueId = $leagueId
    season = 2026
    rounds = 2
    snake = $false
    pickDurationMinutes = 60
    teamDraftRound = $null
  }
  Assert-True ($draftResp.status -eq 201) "Draft creation failed: status=$($draftResp.status) body=$($draftResp.raw)"
  $draftId = [int]$draftResp.json.id
  Add-Result -Step "create-draft" -Status "PASS" -Detail "draftId=$draftId"

  $uploadPlayers = Invoke-Api -Method "POST" -Path "/api/drafts/$draftId/players/upload" -Session $admin.session -Body @{
    mlbIds = @(900001, 900002, 900003, 900004, 900005)
  }
  Assert-True ($uploadPlayers.status -eq 200) "Player upload failed: status=$($uploadPlayers.status) body=$($uploadPlayers.raw)"
  Assert-True (($uploadPlayers.json.notFound.Count -eq 0)) "Expected no missing MLB IDs, got: $($uploadPlayers.raw)"
  Add-Result -Step "upload-mlb-api-id-list" -Status "PASS" -Detail "added=$($uploadPlayers.json.added) alreadyInPool=$($uploadPlayers.json.alreadyInPool)"

  $csv = @"
Round 1,Round 2
ONE,TWO
TWO,ONE
"@
  $orderResp = Invoke-Api -Method "POST" -Path "/api/drafts/$draftId/order/upload-csv" -Session $admin.session -Body @{
    csvData = $csv
  }
  Assert-True ($orderResp.status -eq 200) "Order CSV upload failed: status=$($orderResp.status) body=$($orderResp.raw)"
  Assert-True ([int]$orderResp.json.rounds -eq 2) "Expected 2 rounds from CSV upload"
  Add-Result -Step "upload-order-csv" -Status "PASS" -Detail "rounds=$($orderResp.json.rounds) entries=$($orderResp.json.totalEntries)"

  $roundsResp = Invoke-Api -Method "GET" -Path "/api/drafts/$draftId/rounds" -Session $admin.session
  Assert-True ($roundsResp.status -eq 200) "Fetch rounds failed"
  Assert-True ($roundsResp.json.Count -eq 2) "Expected exactly 2 rounds"

  $nowMinus2 = (Get-Date).AddMinutes(-2).ToString("yyyy-MM-ddTHH:mm:ss")
  $nowMinus1 = (Get-Date).AddMinutes(-1).ToString("yyyy-MM-ddTHH:mm:ss")
  $round1Id = [int]$roundsResp.json[0].id
  $round2Id = [int]$roundsResp.json[1].id

  $patchR1 = Invoke-Api -Method "PATCH" -Path "/api/drafts/$draftId/rounds/$round1Id" -Session $admin.session -Body @{
    startTime = $nowMinus2
    isTeamDraft = $false
  }
  Assert-True ($patchR1.status -eq 200) "Patch round1 failed: status=$($patchR1.status) body=$($patchR1.raw)"

  $patchR2 = Invoke-Api -Method "PATCH" -Path "/api/drafts/$draftId/rounds/$round2Id" -Session $admin.session -Body @{
    startTime = $nowMinus1
    isTeamDraft = $true
  }
  Assert-True ($patchR2.status -eq 200) "Patch round2 failed: status=$($patchR2.status) body=$($patchR2.raw)"
  Add-Result -Step "configure-rounds" -Status "PASS" -Detail "round2 team draft enabled"

  $startResp = Invoke-Api -Method "POST" -Path "/api/drafts/$draftId/start" -Session $admin.session
  Assert-True ($startResp.status -eq 200) "Start draft failed: status=$($startResp.status) body=$($startResp.raw)"
  Add-Result -Step "start-draft" -Status "PASS" -Detail "status=$($startResp.json.status)"

  $playersResp = Invoke-Api -Method "GET" -Path "/api/drafts/$draftId/players" -Session $owner1.session
  Assert-True ($playersResp.status -eq 200) "Get available players failed"
  $playerByMlbId = @{}
  foreach ($dp in $playersResp.json) {
    $playerByMlbId[[string]$dp.player.mlbId] = [int]$dp.mlbPlayerId
  }
  Assert-True ($playerByMlbId.ContainsKey("900004")) "Expected MLB ID 900004 in draft pool"
  Assert-True ($playerByMlbId.ContainsKey("900002")) "Expected MLB ID 900002 in draft pool"
  Add-Result -Step "resolve-player-id-map" -Status "PASS" -Detail "Mapped MLB API IDs to internal IDs"

  $pick1 = Invoke-Api -Method "POST" -Path "/api/drafts/$draftId/pick" -Session $owner1.session -Body @{
    mlbPlayerId = $playerByMlbId["900004"]
    rosterType = "milb"
  }
  Assert-True ($pick1.status -eq 201) "Owner1 round1 pick failed: status=$($pick1.status) body=$($pick1.raw)"

  $pick2 = Invoke-Api -Method "POST" -Path "/api/drafts/$draftId/pick" -Session $owner2.session -Body @{
    mlbPlayerId = $playerByMlbId["900002"]
    rosterType = "milb"
  }
  Assert-True ($pick2.status -eq 201) "Owner2 round1 pick failed: status=$($pick2.status) body=$($pick2.raw)"
  Add-Result -Step "round1-regular-picks" -Status "PASS" -Detail "Both regular picks succeeded"

  $teamPick1 = Invoke-Api -Method "POST" -Path "/api/drafts/$draftId/pick" -Session $owner1.session -Body @{
    selectedOrgName = "OrgA"
    rosterType = "milb"
  }
  Assert-True ($teamPick1.status -eq 201) "Owner1 team draft pick failed: status=$($teamPick1.status) body=$($teamPick1.raw)"
  Assert-True ($teamPick1.json.teamDraft -eq $true) "Expected teamDraft=true for team pick"
  Add-Result -Step "round2-team-pick-owner1" -Status "PASS" -Detail "org=OrgA playersDrafted=$($teamPick1.json.playersDrafted)"

  $invalidTeamPayload = Invoke-Api -Method "POST" -Path "/api/drafts/$draftId/pick" -Session $owner2.session -Body @{
    rosterType = "milb"
  }
  Assert-True ($invalidTeamPayload.status -eq 400) "Expected invalid team draft payload rejection (400), got $($invalidTeamPayload.status)"
  Add-Result -Step "team-payload-validation" -Status "PASS" -Detail "Missing selectedOrgName rejected"

  $dupOrg = Invoke-Api -Method "POST" -Path "/api/drafts/$draftId/pick" -Session $owner2.session -Body @{
    selectedOrgName = "OrgA"
    rosterType = "milb"
  }
  Assert-True ($dupOrg.status -eq 400) "Expected duplicate-org pick to fail with 400; got status=$($dupOrg.status)"
  $dupDetail = $dupOrg.raw
  if ($dupOrg.json -and $dupOrg.json.message) {
    $dupDetail = [string]$dupOrg.json.message
  }
  Add-Result -Step "duplicate-org-rejected" -Status "PASS" -Detail $dupDetail

  $teamPick2 = Invoke-Api -Method "POST" -Path "/api/drafts/$draftId/commissioner-pick" -Session $admin.session -Body @{
    userId = $owner2.userId
    selectedOrgName = "OrgB"
    rosterType = "milb"
  }
  Assert-True ($teamPick2.status -eq 201) "Commissioner team draft pick failed: status=$($teamPick2.status) body=$($teamPick2.raw)"
  Add-Result -Step "commissioner-team-pick-owner2" -Status "PASS" -Detail "org=OrgB playersDrafted=$($teamPick2.json.playersDrafted)"

  $picksResp = Invoke-Api -Method "GET" -Path "/api/drafts/$draftId/picks" -Session $admin.session
  Assert-True ($picksResp.status -eq 200) "Failed to fetch picks"
  Assert-True ($picksResp.json.Count -eq 4) "Expected 4 draft slots/picks"
  $unmade = @($picksResp.json | Where-Object { -not $_.madeAt }).Count
  Assert-True ($unmade -eq 0) "Expected all picks filled, but $unmade slots are still open"

  $draftFinal = Invoke-Api -Method "GET" -Path "/api/drafts/$draftId" -Session $admin.session
  Assert-True ($draftFinal.status -eq 200) "Failed to fetch final draft"
  Assert-True ($draftFinal.json.status -eq "completed") "Expected draft status=completed, got $($draftFinal.json.status)"
  Add-Result -Step "draft-completed" -Status "PASS" -Detail "All slots filled and draft auto-completed"

  Add-Result -Step "overall" -Status "PASS" -Detail "Full draft logic scenario passed"
} catch {
  Add-Result -Step "overall" -Status "FAIL" -Detail $_.Exception.Message
} finally {
  $outDir = "attached_assets/draft-full-test"
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  $outPath = Join-Path $outDir "results.json"
  $results | ConvertTo-Json -Depth 8 | Set-Content -Path $outPath
  Get-Content $outPath
}
