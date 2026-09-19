# API smoke for altcoin auto/email/history
$base = 'http://localhost:3000/api'
$body = @{ username = 'admin'; password = 'admin123' } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType 'application/json' -Body $body
$token = $login.accessToken
if (-not $token) { $token = $login.token }
if (-not $token) { Write-Host "LOGIN FAIL"; $login | ConvertTo-Json -Depth 5; exit 1 }
$headers = @{ Authorization = "Bearer $token" }
Write-Host "LOGIN OK"

# settings get
$s = Invoke-RestMethod -Uri "$base/altcoin/settings" -Headers $headers
Write-Host "SETTINGS" ($s | ConvertTo-Json -Compress)

# enable auto
$on = Invoke-RestMethod -Uri "$base/altcoin/settings" -Method Put -Headers $headers -ContentType 'application/json' -Body '{"autoScanEmail":true}'
Write-Host "AUTO ON" ($on | ConvertTo-Json -Compress)

# disable auto for clean state after note
$off = Invoke-RestMethod -Uri "$base/altcoin/settings" -Method Put -Headers $headers -ContentType 'application/json' -Body '{"autoScanEmail":false}'
Write-Host "AUTO OFF" ($off | ConvertTo-Json -Compress)

# history list
$h = Invoke-RestMethod -Uri "$base/altcoin/history"
Write-Host "HISTORY count" $h.items.Count
if ($h.items.Count -gt 0) {
  $file = $h.items[0].file
  $html = Invoke-WebRequest -Uri "$base/altcoin/history/$file" -UseBasicParsing
  Write-Host "HISTORY HTML" $html.StatusCode "len" $html.Content.Length "has canvas" ($html.Content -match 'canvas')
}

# small scan
$scanBody = @{ threshold = 5; daysToCheck = 10; previousDays = 7; maxSymbols = 30; concurrency = 4; emailNotify = $false } | ConvertTo-Json
try {
  $scan = Invoke-RestMethod -Uri "$base/altcoin/scan" -Method Post -Headers $headers -ContentType 'application/json' -Body $scanBody
  Write-Host "SCAN START" ($scan | ConvertTo-Json -Compress -Depth 4)
} catch {
  Write-Host "SCAN ERR" $_.Exception.Message
  if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
}

# poll up to 90s
for ($i = 0; $i -lt 45; $i++) {
  Start-Sleep -Seconds 2
  $st = Invoke-RestMethod -Uri "$base/altcoin/status"
  Write-Host "STATUS $($st.done)/$($st.total) running=$($st.running) err=$($st.error)"
  if (-not $st.running) { break }
}

$res = Invoke-RestMethod -Uri "$base/altcoin/results"
Write-Host "RESULTS coins" $res.coins.Count "report" ($res.lastReport | ConvertTo-Json -Compress) "notify" ($res.lastNotify | ConvertTo-Json -Compress)

$h2 = Invoke-RestMethod -Uri "$base/altcoin/history"
Write-Host "HISTORY2 count" $h2.items.Count
if ($h2.items.Count -gt 0) {
  Write-Host "LATEST" ($h2.items[0] | ConvertTo-Json -Compress)
  $html2 = Invoke-WebRequest -Uri "$base/altcoin/history/$($h2.items[0].file)" -UseBasicParsing
  Write-Host "LATEST HTML" $html2.StatusCode "len" $html2.Content.Length
}
