$base = 'http://localhost:3000/api'
$body = @{ username = 'admin'; password = 'admin123' } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType 'application/json' -Body $body
$headers = @{ Authorization = "Bearer $($login.accessToken)" }

# enable BTC-USDT 5m with LOW threshold so we likely hit
$cfg = @{
  configs = @(
    @{
      alert_type = 'volatility'
      exchange = 'okx'
      symbol = 'BTC-USDT'
      timeframes = @('5m','1H')
      thresholds = @{ '5m' = 0.01; '1H' = 0.01 }
      is_enabled = 1
    }
  )
} | ConvertTo-Json -Depth 6
$batch = Invoke-RestMethod -Uri "$base/alerts/configs/batch" -Method Post -Headers $headers -ContentType 'application/json' -Body $cfg
Write-Host "BATCH" ($batch | ConvertTo-Json -Compress)

$set = Invoke-RestMethod -Uri "$base/alerts/monitor/settings" -Method Put -Headers $headers -ContentType 'application/json' -Body '{"emailNotify":false}'
Write-Host "SETTINGS" ($set | ConvertTo-Json -Compress)

$st0 = Invoke-RestMethod -Uri "$base/alerts/monitor/status" -Headers $headers
Write-Host "STATUS0" ($st0 | ConvertTo-Json -Compress)

$chk = Invoke-RestMethod -Uri "$base/alerts/monitor/check" -Method Post -Headers $headers
Write-Host "CHECK hits=$($chk.hits.Count) configs=$($chk.configs) email=$($chk.email | ConvertTo-Json -Compress)"
if ($chk.hits.Count -gt 0) {
  Write-Host "HIT0" ($chk.hits[0] | ConvertTo-Json -Compress)
} else {
  Write-Host "NO_HITS (may need proxy or market quiet) lastError probe:"
}

$hist = Invoke-RestMethod -Uri "$base/alerts/history?limit=5" -Headers $headers
Write-Host "HIST total=$($hist.pagination.total)"
$hist.alerts | Select-Object -First 3 | ForEach-Object { Write-Host (" - " + $_.message) }

$start = Invoke-RestMethod -Uri "$base/alerts/monitor/start" -Method Post -Headers $headers
Write-Host "START" ($start | ConvertTo-Json -Compress)
Start-Sleep -Seconds 1
$st1 = Invoke-RestMethod -Uri "$base/alerts/monitor/status" -Headers $headers
Write-Host "STATUS1" ($st1 | ConvertTo-Json -Compress)
