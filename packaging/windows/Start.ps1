$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Node = Join-Path $Root "runtime\node.exe"
$EnvFile = Join-Path $Root ".env.local"
$CredentialFile = Join-Path $Root "first-run-credentials.txt"
$PidFile = Join-Path $Root "server.pid"
$Url = "http://127.0.0.1:4173"

if (-not (Test-Path $Node)) {
  throw "Bundled Node.js runtime is missing: $Node"
}

if (Test-Path $PidFile) {
  $ExistingPid = (Get-Content $PidFile -Raw).Trim()
  if ($ExistingPid -and (Get-Process -Id $ExistingPid -ErrorAction SilentlyContinue)) {
    Write-Host "AI Project Command Platform is already running at $Url"
    Start-Process $Url
    exit 0
  }
  Remove-Item $PidFile -Force
}

$FirstRunPassword = $null
if (-not (Test-Path $EnvFile)) {
  $Bytes = New-Object byte[] 24
  [Security.Cryptography.RandomNumberGenerator]::Fill($Bytes)
  $FirstRunPassword = ([Convert]::ToBase64String($Bytes)).TrimEnd("=").Replace("+", "A").Replace("/", "B")
  @"
HOST=127.0.0.1
PORT=4173
PLATFORM_DATA_DIR=./data
PLATFORM_BOOTSTRAP_USERNAME=admin
PLATFORM_BOOTSTRAP_DISPLAY_NAME=平台管理员
PLATFORM_BOOTSTRAP_PASSWORD=$FirstRunPassword
PLATFORM_COOKIE_SECURE=false
AI_CHAT_PROVIDER=disabled
AI_GENERATION_PROVIDER=disabled
"@ | Set-Content -Path $EnvFile -Encoding utf8
  @"
AI Project Command Platform
URL: $Url
Username: admin
Password: $FirstRunPassword

请在首次登录后立即修改密码，并妥善删除本文件。
"@ | Set-Content -Path $CredentialFile -Encoding utf8
}

$Process = Start-Process -FilePath $Node `
  -ArgumentList @("--env-file-if-exists=.env", "--env-file-if-exists=.env.local", "server.mjs") `
  -WorkingDirectory $Root `
  -PassThru `
  -WindowStyle Hidden
$Process.Id | Set-Content -Path $PidFile -Encoding ascii

$Ready = $false
for ($Attempt = 0; $Attempt -lt 40; $Attempt++) {
  Start-Sleep -Milliseconds 500
  if ($Process.HasExited) {
    throw "Server exited during startup. Run runtime\node.exe server.mjs in a terminal for diagnostics."
  }
  try {
    $Response = Invoke-WebRequest -UseBasicParsing -Uri "$Url/health" -TimeoutSec 2
    if ($Response.StatusCode -eq 200) {
      $Ready = $true
      break
    }
  } catch {
    # Continue bounded startup polling.
  }
}
if (-not $Ready) {
  Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
  throw "Server did not become ready at $Url"
}

Write-Host "AI Project Command Platform started: $Url"
if ($FirstRunPassword) {
  Write-Host "Username: admin"
  Write-Host "Password: $FirstRunPassword"
  Write-Host "Credentials were also written to: $CredentialFile"
}
Start-Process $Url
