$base = 'http://localhost:3000/api'
$login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType 'application/json' -Body '{"username":"admin","password":"admin123"}'
$h = @{ Authorization = "Bearer $($login.accessToken)" }

Write-Host "=== stablecoin auto config ==="
$scBody = @{ coins = @('USDT','USDC','DAI'); threshold = 0.005; emailNotify = $false; autoScan = $true; intervalSec = 300 } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "$base/stablecoins/config" -Method Put -Headers $h -ContentType 'application/json' -Body $scBody | ConvertTo-Json -Compress

Write-Host "=== stablecoin auto check ==="
$scChk = Invoke-RestMethod -Uri "$base/alerts/stablecoin/check-auto" -Method Post -Headers $h
Write-Host ("depegged={0} fresh={1} summary={2}" -f $scChk.depegged, $scChk.freshHits, ($scChk.summary | ConvertTo-Json -Compress))

Write-Host "=== drawdown with equity ==="
# seed equity via settings? drawdown reads last_balance_* from portfolio settings - set through db by using save? We'll PUT drawdown and check
$ddBody = @{ enabled = $true; threshold = 5; emailNotify = $false } | ConvertTo-Json
Invoke-RestMethod -Uri "$base/alerts/drawdown/config" -Method Put -Headers $h -ContentType 'application/json' -Body $ddBody | ConvertTo-Json -Compress
$dd = Invoke-RestMethod -Uri "$base/alerts/drawdown/check" -Method Post -Headers $h
Write-Host ($dd | ConvertTo-Json -Compress -Depth 5)

Write-Host "=== news check ==="
$nBody = @{ enabled = $true; risk = 15; emailNotify = $false; cats = @{ macro = $true; regulation = $true; exchange = $true } } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "$base/alerts/news/config" -Method Put -Headers $h -ContentType 'application/json' -Body $nBody | ConvertTo-Json -Compress
try {
  $news = Invoke-RestMethod -Uri "$base/alerts/news/check" -Method Post -Headers $h
  Write-Host ("ok={0} scanned={1} risk={2} hits={3}" -f $news.ok, $news.scanned, $news.maxRisk, $news.hits)
  if ($news.items) { $news.items | Select-Object -First 2 | ForEach-Object { Write-Host (" - [{0}] {1}" -f $_.score, $_.title) } }
} catch {
  Write-Host "NEWS_ERR $($_.Exception.Message)"
  if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
}

Write-Host "=== runtime ==="
Invoke-RestMethod -Uri "$base/alerts/runtime" -Headers $h | ConvertTo-Json -Compress -Depth 6

Write-Host "=== history ==="
$hist = Invoke-RestMethod -Uri "$base/alerts/history?limit=8" -Headers $h
Write-Host "total=$($hist.pagination.total)"
$hist.alerts | ForEach-Object { Write-Host (" - [{0}] {1}" -f $_.alert_type, $_.message) }

# stop auto loops to avoid noise
Invoke-RestMethod -Uri "$base/stablecoins/config" -Method Put -Headers $h -ContentType 'application/json' -Body (@{ coins = @('USDT','USDC','DAI'); threshold = 0.005; emailNotify = $false; autoScan = $false } | ConvertTo-Json) | Out-Null
Invoke-RestMethod -Uri "$base/alerts/drawdown/config" -Method Put -Headers $h -ContentType 'application/json' -Body '{"enabled":false}' | Out-Null
Invoke-RestMethod -Uri "$base/alerts/news/config" -Method Put -Headers $h -ContentType 'application/json' -Body '{"enabled":false}' | Out-Null
Invoke-RestMethod -Uri "$base/alerts/runtime/sync" -Method Post -Headers $h | ConvertTo-Json -Compress -Depth 4
