<#
.SYNOPSIS
  Resilient one-command launcher for WaveSpeed Studio.

.DESCRIPTION
  Checks Node.js, project files, and port status before launching server.js.
  - Reuses a healthy existing WaveSpeed Studio instance instead of crashing with EADDRINUSE.
  - Refuses to hijack or kill unrelated processes occupying the target port.
  - Waits for /api/outputs health confirmation before opening the default browser.
  - Supports -Status, -Restart, -Stop, -NoBrowser, -Background, and -Port <int>.
#>
[CmdletBinding()]
param(
  [int]$Port = 3000,
  [switch]$NoBrowser,
  [switch]$Restart,
  [switch]$Stop,
  [switch]$Status,
  [switch]$Background
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ServerJs = Join-Path $ProjectRoot 'server.js'
if (-not $env:WAVESPEED_USER_DATA_DIR) {
  $env:WAVESPEED_USER_DATA_DIR = if ($env:APPDATA) {
    Join-Path $env:APPDATA 'wavespeed-studio'
  } else {
    $ProjectRoot
  }
}
$UserDataRoot = $env:WAVESPEED_USER_DATA_DIR
$DbPath = Join-Path $UserDataRoot 'database\studio_history.sqlite'
$OutputsDir = if ($env:WAVESPEED_OUTPUTS_DIR) { $env:WAVESPEED_OUTPUTS_DIR } else { Join-Path $UserDataRoot 'outputs' }
$LogsDir = Join-Path $UserDataRoot 'logs'
$ServerLog = Join-Path $LogsDir 'server.log'
$StudioUrl = "http://localhost:$Port"
$HealthUrl = "http://127.0.0.1:$Port/api/outputs"

function Get-PortOwnerInfo([int]$TargetPort) {
  $conns = Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue
  if (-not $conns) { return $null }
  $owningPid = ($conns | Select-Object -First 1).OwningProcess
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $owningPid" -ErrorAction SilentlyContinue
  $cmdLine = if ($proc) { [string]$proc.CommandLine } else { '' }
  $procName = if ($proc) { [string]$proc.Name } else { 'unknown' }
  $isStudioProc = ($procName -match '^node(\.exe)?$') -and ($cmdLine -match [regex]::Escape('server.js')) -and (
    ($cmdLine -match [regex]::Escape($ProjectRoot)) -or ($cmdLine -match 'server\.js"?\s*$')
  )
  return [pscustomobject]@{
    Pid          = $owningPid
    Name         = $procName
    CommandLine  = $cmdLine
    IsStudioProc = $isStudioProc
  }
}

function Test-StudioHealth([string]$Url) {
  try {
    $resp = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 2
    if ($null -ne $resp -and $resp.PSObject.Properties.Name -contains 'outputs_dir') {
      return [pscustomobject]@{
        Healthy    = $true
        OutputsDir = [string]$resp.outputs_dir
        MatchesApp = ([string]$resp.outputs_dir).Trim() -ne ''
      }
    }
    return [pscustomobject]@{ Healthy = $false; OutputsDir = ''; MatchesApp = $false }
  } catch {
    return [pscustomobject]@{ Healthy = $false; OutputsDir = ''; MatchesApp = $false }
  }
}

function Stop-VerifiedStudio([int]$TargetPort) {
  $owner = Get-PortOwnerInfo -TargetPort $TargetPort
  if (-not $owner) {
    Write-Host "[OK] Nothing is listening on port $TargetPort." -ForegroundColor Gray
    return $true
  }
  if (-not $owner.IsStudioProc) {
    Write-Host "[BLOCKED] Port $TargetPort is used by an UNRELATED process:" -ForegroundColor Red
    Write-Host "  PID: $($owner.Pid) | Name: $($owner.Name)" -ForegroundColor Yellow
    Write-Host "  Cmd: $($owner.CommandLine)" -ForegroundColor Yellow
    Write-Host "Refusing to stop it automatically. Use '-Port 3001' or stop PID $($owner.Pid) manually." -ForegroundColor Yellow
    return $false
  }
  Write-Host "[STOP] Stopping WaveSpeed Studio (PID $($owner.Pid)) on port $TargetPort..." -ForegroundColor Cyan
  Stop-Process -Id $owner.Pid -Force -ErrorAction Stop
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 150
    if (-not (Get-PortOwnerInfo -TargetPort $TargetPort)) {
      Write-Host "[OK] Port $TargetPort released cleanly." -ForegroundColor Green
      return $true
    }
  }
  Write-Host "[WARN] Process $($owner.Pid) stopped, waiting on socket TIME_WAIT." -ForegroundColor Yellow
  return $true
}

Write-Host "=================================================================" -ForegroundColor DarkCyan
Write-Host " WaveSpeed Studio Launcher" -ForegroundColor Cyan
Write-Host " Root:     $ProjectRoot"
Write-Host " URL:      $StudioUrl"
Write-Host " Database: $DbPath"
Write-Host " Outputs:  $OutputsDir"
Write-Host " Logs:     $ServerLog"
Write-Host "=================================================================" -ForegroundColor DarkCyan

if (-not (Test-Path $ServerJs)) {
  Write-Host "[ERROR] Missing server.js at $ServerJs" -ForegroundColor Red
  exit 1
}
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
  Write-Host "[ERROR] Node.js was not found in PATH. Install Node.js v20+ first." -ForegroundColor Red
  exit 1
}

if ($Status) {
  $owner = Get-PortOwnerInfo -TargetPort $Port
  $health = Test-StudioHealth -Url $HealthUrl
  if ($health.Healthy -and $health.MatchesApp) {
    Write-Host "[RUNNING] WaveSpeed Studio is LIVE at $StudioUrl" -ForegroundColor Green
    if ($owner) { Write-Host "  PID: $($owner.Pid) ($($owner.Name))" }
    Write-Host "  To open:   start $StudioUrl"
    Write-Host "  To restart: .\Launch Studio.cmd -Restart"
    Write-Host "  To stop:    .\Launch Studio.cmd -Stop"
    exit 0
  } elseif ($owner) {
    Write-Host "[OCCUPIED] Port $Port has another process: PID $($owner.Pid) ($($owner.Name)) — health check failed." -ForegroundColor Yellow
    exit 2
  } else {
    Write-Host "[STOPPED] WaveSpeed Studio is not running on port $Port." -ForegroundColor Gray
    exit 3
  }
}

if ($Stop) {
  $ok = Stop-VerifiedStudio -TargetPort $Port
  exit ($(if ($ok) { 0 } else { 1 }))
}

if ($Restart) {
  $stopped = Stop-VerifiedStudio -TargetPort $Port
  if (-not $stopped) { exit 1 }
}

$existingOwner = Get-PortOwnerInfo -TargetPort $Port
$existingHealth = Test-StudioHealth -Url $HealthUrl

if ($existingHealth.Healthy -and $existingHealth.MatchesApp) {
  Write-Host "[REUSE] WaveSpeed Studio is already healthy on port $Port (PID $(if ($existingOwner) { $existingOwner.Pid } else { 'active' }))." -ForegroundColor Green
  if (-not $NoBrowser) {
    Write-Host "[OPEN] Opening $StudioUrl in your default browser..." -ForegroundColor Cyan
    Start-Process $StudioUrl
  }
  Write-Host "Tips: Run 'Launch Studio.cmd -Restart' to restart, or 'Launch Studio.cmd -Stop' to stop." -ForegroundColor Gray
  exit 0
}

if ($existingOwner) {
  Write-Host "[ERROR] Port $Port is occupied by another service or stale process:" -ForegroundColor Red
  Write-Host "  PID: $($existingOwner.Pid) | Name: $($existingOwner.Name)" -ForegroundColor Yellow
  Write-Host "  Cmd: $($existingOwner.CommandLine)" -ForegroundColor Yellow
  if ($existingOwner.IsStudioProc) {
    Write-Host "Run 'Launch Studio.cmd -Restart' to cleanly restart it." -ForegroundColor Cyan
  } else {
    Write-Host "Run 'Launch Studio.cmd -Port 3001' to use another port without touching PID $($existingOwner.Pid)." -ForegroundColor Cyan
  }
  exit 1
}

# Start fresh Node process on $Port
$env:PORT = "$Port"
if ($Background) {
  $proc = Start-Process -FilePath $nodeCmd.Source -ArgumentList "`"$ServerJs`"" -WorkingDirectory $ProjectRoot -WindowStyle Hidden -PassThru
  $ready = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 250
    if ($proc.HasExited) {
      Write-Host "[ERROR] server.js exited early (code $($proc.ExitCode)). Check $ServerLog" -ForegroundColor Red
      exit 1
    }
    $h = Test-StudioHealth -Url $HealthUrl
    if ($h.Healthy -and $h.MatchesApp) { $ready = $true; break }
  }
  if (-not $ready) {
    Write-Host "[ERROR] Timed out waiting for $HealthUrl. Check $ServerLog" -ForegroundColor Red
    exit 1
  }
  Write-Host "[READY] WaveSpeed Studio running in background (PID $($proc.Id)) -> $StudioUrl" -ForegroundColor Green
  if (-not $NoBrowser) { Start-Process $StudioUrl }
  Write-Host "Stop anytime with: Launch Studio.cmd -Stop" -ForegroundColor Gray
  exit 0
}

# Interactive console mode: wait until healthy before opening browser, then stream Node foreground until Ctrl+C
Write-Host "[START] Starting server.js on port $Port..." -ForegroundColor Cyan
$browserJob = $null
if (-not $NoBrowser) {
  $browserJob = Start-Job -ScriptBlock {
    param($CheckUrl, $OpenUrl, $ExpectOut)
    for ($i = 0; $i -lt 45; $i++) {
      Start-Sleep -Milliseconds 250
      try {
        $resp = Invoke-RestMethod -Uri $CheckUrl -Method Get -TimeoutSec 2
        if ($null -ne $resp -and $resp.PSObject.Properties.Name -contains 'outputs_dir') {
          Start-Process $OpenUrl
          return
        }
      } catch {}
    }
  } -ArgumentList $HealthUrl, $StudioUrl, $OutputsDir
}

Write-Host "[INFO] Press Ctrl+C in this window to stop the server cleanly." -ForegroundColor Gray
Push-Location $ProjectRoot
try {
  & $nodeCmd.Source $ServerJs
} finally {
  Pop-Location
  if ($browserJob) {
    Remove-Job -Job $browserJob -Force -ErrorAction SilentlyContinue
  }
}
