$base = 'http://localhost:3000/api'
$login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType 'application/json' -Body '{"username":"admin","password":"admin123"}'
$headers = @{ Authorization = "Bearer $($login.accessToken)" }
$cfg = @{
  configs = @(
    @{
      alert_type = 'volatility'
      exchange = 'okx'
      symbol = 'BTC-USDT'
      timeframes = @('5m')
      thresholds = @{ '5m' = 3 }
      is_enabled = 0
    }
  )
} | ConvertTo-Json -Depth 6
Invoke-RestMethod -Uri "$base/alerts/configs/batch" -Method Post -Headers $headers -ContentType 'application/json' -Body $cfg | ConvertTo-Json -Compress
Invoke-RestMethod -Uri "$base/alerts/monitor/stop" -Method Post -Headers $headers | ConvertTo-Json -Compress
Invoke-RestMethod -Uri "$base/alerts/monitor/status" -Headers $headers | ConvertTo-Json -Compress
