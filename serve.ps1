# 启动本地服务器，手机可通过局域网 IP 访问
$port = 8080
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -ne "WellKnown" } | Select-Object -First 1).IPAddress
if (-not $ip) { $ip = "127.0.0.1" }

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  工作分析习题集 - 本地服务器已启动" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  电脑访问: http://localhost:$port" -ForegroundColor Yellow
Write-Host "  手机访问: http://${ip}:$port" -ForegroundColor Yellow
Write-Host ""
Write-Host "  请确保手机与电脑在同一 WiFi 网络下" -ForegroundColor Gray
Write-Host "  按 Ctrl+C 停止服务器" -ForegroundColor Gray
Write-Host ""

Set-Location $PSScriptRoot
python -m http.server $port --bind 0.0.0.0
