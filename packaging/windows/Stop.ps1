$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$PidFile = Join-Path $Root "server.pid"

if (-not (Test-Path $PidFile)) {
  Write-Host "AI Project Command Platform is not running."
  exit 0
}

$ServerPid = (Get-Content $PidFile -Raw).Trim()
if ($ServerPid) {
  Stop-Process -Id $ServerPid -ErrorAction SilentlyContinue
}
Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
Write-Host "AI Project Command Platform stopped."
