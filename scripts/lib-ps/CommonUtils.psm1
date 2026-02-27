# CommonUtils.psm1 — Farasa PowerShell Utility Library
# Shared utilities, colors, logging, port checks

$script:DEV_PORT      = 3000
$script:STUDIO_PORT   = 4983
$script:POSTGRES_PORT = 5432
$script:ADMINER_PORT  = 8080

function Write-FSuccess  { param($Msg) Write-Host "✓ $Msg" -ForegroundColor Green }
function Write-FFail     { param($Msg) Write-Host "✗ $Msg" -ForegroundColor Red }
function Write-FWarning  { param($Msg) Write-Host "⚠ $Msg" -ForegroundColor Yellow }
function Write-FInfo     { param($Msg) Write-Host "ℹ $Msg" -ForegroundColor Cyan }
function Write-FStep     { param($Msg) Write-Host "➤ $Msg" -ForegroundColor Magenta }

function Write-FLogFarasa   { param($Line) Write-Host "[FARASA  ] $Line" -ForegroundColor Cyan }
function Write-FLogPostgres { param($Line) Write-Host "[POSTGRES] $Line" -ForegroundColor Blue }
function Write-FLogStudio   { param($Line) Write-Host "[STUDIO  ] $Line" -ForegroundColor Magenta }
function Write-FLogTsc      { param($Line) Write-Host "[TSC     ] $Line" -ForegroundColor Yellow }
function Write-FLogLint     { param($Line) Write-Host "[LINT    ] $Line" -ForegroundColor DarkYellow }
function Write-FLogBuild    { param($Line) Write-Host "[BUILD   ] $Line" -ForegroundColor Green }

function Test-Port {
    param([int]$Port)
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("127.0.0.1", $Port)
        $tcp.Close()
        return $true
    } catch {
        return $false
    }
}

function Stop-Port {
    param([int]$Port)
    $procs = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
             Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique
    foreach ($pid in $procs) {
        try { Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue } catch { }
    }
}

function Wait-ForPort {
    param([int]$Port, [string]$Name, [int]$TimeoutSec = 30)
    Write-FStep "Waiting for $Name on port $Port..."
    for ($i = 0; $i -lt $TimeoutSec; $i++) {
        if (Test-Port $Port) {
            Write-FSuccess "$Name is ready (port $Port)"
            return $true
        }
        if ($i % 5 -eq 0 -and $i -gt 0) { Write-FInfo "Still waiting... ($i/${TimeoutSec}s)" }
        Start-Sleep 1
    }
    Write-FFail "$Name did not start within ${TimeoutSec}s"
    return $false
}

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

function Test-DockerRunning {
    try {
        $null = docker info 2>&1
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

Export-ModuleMember -Function *
