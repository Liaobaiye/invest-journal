$base = 'http://localhost:3000/api'
$login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType 'application/json' -Body '{"username":"admin","password":"admin123"}'
$h = @{ Authorization = "Bearer $($login.accessToken)" }
try {
  $r = Invoke-RestMethod -Uri "$base/alerts/drawdown/check" -Method Post -Headers $h
  $r | ConvertTo-Json -Compress -Depth 6
} catch {
  Write-Host "STATUS $($_.Exception.Response.StatusCode.value__)"
  if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message } else { Write-Host $_.Exception.Message }
}
Write-Host "RUNTIME"
(Invoke-RestMethod -Uri "$base/alerts/runtime" -Headers $h).drawdown | ConvertTo-Json -Compress -Depth 5
