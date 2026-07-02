# GitHub Pages 一键部署脚本
# 用法: $env:GITHUB_TOKEN = "ghp_xxxx"; .\deploy.ps1

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Git  = Join-Path $Root ".tools\PortableGit\cmd\git.exe"
$Gh   = Join-Path $Root ".tools\bin\gh.exe"
$Repo = "work-analysis-quiz"

if (-not (Test-Path $Git)) { Write-Error "未找到 Git，请先运行安装步骤"; exit 1 }
if (-not (Test-Path $Gh))  { Write-Error "未找到 GitHub CLI"; exit 1 }

if (-not $env:GITHUB_TOKEN) {
  Write-Host "请先设置 GitHub Token:" -ForegroundColor Yellow
  Write-Host '  $env:GITHUB_TOKEN = "ghp_你的Token"' -ForegroundColor Cyan
  Write-Host "Token 需要 repo 权限。创建地址: https://github.com/settings/tokens" -ForegroundColor Gray
  exit 1
}

Set-Location $Root

Write-Host "正在登录 GitHub..." -ForegroundColor Cyan
$env:GITHUB_TOKEN | & $Gh auth login --with-token
if ($LASTEXITCODE -ne 0) { Write-Error "GitHub 登录失败，请检查 Token"; exit 1 }

$owner = (& $Gh api user -q .login).Trim()
Write-Host "已登录: $owner" -ForegroundColor Green

# 检查远程仓库
$remoteExists = $false
try {
  & $Git remote get-url origin 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { $remoteExists = $true }
} catch {}

if (-not $remoteExists) {
  Write-Host "正在创建仓库 $owner/$Repo ..." -ForegroundColor Cyan
  & $Gh repo create $Repo --public --source=. --remote=origin --push
  if ($LASTEXITCODE -ne 0) { Write-Error "创建仓库失败"; exit 1 }
} else {
  Write-Host "正在推送到 GitHub..." -ForegroundColor Cyan
  & $Git push -u origin main
  if ($LASTEXITCODE -ne 0) {
    & $Git push -u origin main --force
  }
}

Write-Host "正在启用 GitHub Pages..." -ForegroundColor Cyan
try {
  & $Gh api -X POST "/repos/$owner/$Repo/pages" -f "source[branch]=main" -f "source[path]=/" 2>$null
} catch {
  Write-Host "Pages 可能已启用，尝试更新配置..." -ForegroundColor Yellow
  & $Gh api -X PUT "/repos/$owner/$Repo/pages" -f "source[branch]=main" -f "source[path]=/" 2>$null
}

$pagesUrl = "https://$owner.github.io/$Repo/"
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  部署成功！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  访问地址: $pagesUrl" -ForegroundColor Yellow
Write-Host ""
Write-Host "  首次部署可能需要 1-3 分钟生效" -ForegroundColor Gray
Write-Host ""
