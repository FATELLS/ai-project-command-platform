# install.ps1 — Windows PowerShell 一行安装 AI Project Command Platform
#
# 用法：
#   irm https://github.com/FATELLS/ai-project-command-platform/releases/latest/download/install.ps1 | iex
#
# 或指定安装目录：
#   & (irm https://github.com/FATELLS/ai-project-command-platform/releases/latest/download/install.ps1) -InstallDir "C:\myapp"

param(
  [string]$InstallDir = ".\ai-project-command-platform",
  [string]$Version = ""
)

$ErrorActionPreference = "Stop"
$Repo = "FATELLS/ai-project-command-platform"
$GithubBase = "https://github.com/$Repo/releases"

function Write-Info  { Write-Host "[INFO]  $_" -ForegroundColor Green }
function Write-Warn  { Write-Host "[WARN]  $_" -ForegroundColor Yellow }
function Write-Err   { Write-Host "[ERROR] $_" -ForegroundColor Red; exit 1 }
function Write-Step  { Write-Host "> $_" -ForegroundColor Cyan }

Write-Host ""
Write-Host "================================================" -ForegroundColor White
Write-Host "   AI Project Command Platform Installer" -ForegroundColor White
Write-Host "================================================" -ForegroundColor White
Write-Host ""

# ── detect platform ───────────────────────────────────────────
Write-Step "Detecting platform..."
$arch = $env:PROCESSOR_ARCHITECTURE
if ($arch -eq "AMD64") {
  $platform = "windows-amd64"
} elseif ($arch -eq "ARM64") {
  Write-Err "Windows ARM64 not supported yet"
} else {
  Write-Err "Unsupported architecture: $arch"
}
Write-Info "Platform: $platform"

# ── get version ───────────────────────────────────────────────
Write-Step "Getting latest version..."
if ($Version -eq "") {
  try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -ErrorAction Stop
    $Version = $release.tag_name
  } catch {
    $Version = "latest"
  }
}
Write-Info "Version: $Version"

# ── determine download URL ────────────────────────────────────
if ($Version -eq "latest") {
  $versionPath = "latest/download"
} else {
  $versionPath = "download/$Version"
}

$packageName = "ai-project-command-platform-windows-amd64.zip"
$downloadUrl = "$GithubBase/$versionPath/$packageName"

$tempDir = Join-Path $env:TEMP "aicp-install-$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

try {
  # ── download ──────────────────────────────────────────────────
  Write-Step "Downloading $packageName..."
  Write-Info "URL: $downloadUrl"

  try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile (Join-Path $tempDir $packageName) -ErrorAction Stop
  } catch {
    Write-Err "Download failed: $_`nURL: $downloadUrl"
  }

  $downloadedFile = Join-Path $tempDir $packageName
  $fileSize = [math]::Round((Get-Item $downloadedFile).Length / 1MB, 1)
  Write-Info "Download complete (${fileSize} MB)"
  Write-Host ""

  # ── extract ───────────────────────────────────────────────────
  Write-Step "Extracting to $InstallDir..."

  $absoluteDir = if ([System.IO.Path]::IsPathRooted($InstallDir)) {
    $InstallDir
  } else {
    Join-Path (Get-Location) $InstallDir
  }

  New-Item -ItemType Directory -Path $absoluteDir -Force | Out-Null
  Expand-Archive -Path $downloadedFile -DestinationPath $tempDir -Force

  # Find the top-level directory in the zip
  $extractedTop = Get-ChildItem -Path $tempDir -Directory | Select-Object -First 1
  if ($extractedTop) {
    $sourceDir = $extractedTop.FullName
  } else {
    $sourceDir = $tempDir
  }

  # Copy contents to install dir
  Copy-Item -Path (Join-Path $sourceDir "*") -Destination $absoluteDir -Recurse -Force
  Write-Info "Extraction complete"
  Write-Host ""

  # ── start ─────────────────────────────────────────────────────
  Write-Step "Starting platform..."
  Set-Location $absoluteDir

  $env:PLATFORM_XUGU_LIFECYCLE = if ($env:PLATFORM_XUGU_LIFECYCLE) { $env:PLATFORM_XUGU_LIFECYCLE } else { "native" }
  Write-Info "Windows native mode: Xugu runs directly, no container needed"

  Write-Host ""
  Write-Host "================================================" -ForegroundColor Green
  Write-Host "  Installation complete! Starting..." -ForegroundColor Green
  Write-Host "================================================" -ForegroundColor Green
  Write-Host ""

  & ".\start.bat"
} finally {
  if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}
