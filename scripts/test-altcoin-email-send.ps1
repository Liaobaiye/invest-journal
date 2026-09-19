$base = 'http://localhost:3000/api'
$body = @{ username = 'admin'; password = 'admin123' } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType 'application/json' -Body $body
$headers = @{ Authorization = "Bearer $($login.accessToken)" }
$s = Invoke-RestMethod -Uri "$base/altcoin/settings" -Headers $headers
Write-Host "SETTINGS" ($s | ConvertTo-Json -Compress)
$scanBody = @{ threshold = 5; daysToCheck = 10; previousDays = 7; maxSymbols = 40; concurrency = 4; emailNotify = $true } | ConvertTo-Json
Invoke-RestMethod -Uri "$base/altcoin/scan" -Method Post -Headers $headers -ContentType 'application/json' -Body $scanBody | Out-Null
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 2
  $st = Invoke-RestMethod -Uri "$base/altcoin/status"
  if (-not $st.running) { Write-Host "DONE err=$($st.error)"; break }
}
$res = Invoke-RestMethod -Uri "$base/altcoin/results"
Write-Host "COINS" $res.coins.Count
Write-Host "REPORT" ($res.lastReport.file)
Write-Host "NOTIFY" ($res.lastNotify | ConvertTo-Json -Compress)
