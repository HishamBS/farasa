#Requires -Version 5.1
<#
.SYNOPSIS
    Farasa Platform Management Script — Windows (PowerShell)

.DESCRIPTION
    Interactive CLI for managing Farasa development services on Windows.
    Mirrors the functionality of start.sh for macOS/Linux.

.PARAMETER Command
    dev, dev:hybrid, dev:docker, stop, status, logs,
    db:migrate, db:generate, db:push, db:studio,
    typecheck, lint, build, validate, cleanup

.EXAMPLE
    .\start.ps1
    .\start.ps1 dev
    .\start.ps1 dev:hybrid
    .\start.ps1 stop
    .\start.ps1 db:migrate
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Command = ""
)

# ============================================================================
# Configuration (SSOT)
# ============================================================================
$script:VERSION          = "1.0.0"
$script:SCRIPT_DIR       = $PSScriptRoot
$script:DEV_PORT         = 3000
$script:STUDIO_PORT      = 4983
$script:POSTGRES_PORT    = 5432
$script:ADMINER_PORT     = 8080
$script:STATE_DIR        = "$env:USERPROFILE\.farasa"
$script:PIDS_FILE        = "$($script:STATE_DIR)\farasa.pids"
$script:COMPOSE_DEV      = "docker\docker-compose.dev.yml"
$script:COMPOSE_PROD     = "docker\docker-compose.yml"

# ============================================================================
# Console Output (Color Helpers)
# ============================================================================

function Write-FSuccess  { param($Msg) Write-Host "✓ $Msg" -ForegroundColor Green }
function Write-FFail     { param($Msg) Write-Host "✗ $Msg" -ForegroundColor Red }
function Write-FWarning  { param($Msg) Write-Host "⚠ $Msg" -ForegroundColor Yellow }
function Write-FInfo     { param($Msg) Write-Host "ℹ $Msg" -ForegroundColor Cyan }
function Write-FStep     { param($Msg) Write-Host "➤ $Msg" -ForegroundColor Magenta }

function Write-FHeader {
    param($Text)
    $line = "═" * 60
    Write-Host ""
    Write-Host "╔$line╗" -ForegroundColor Cyan
    $pad = [Math]::Max(0, (60 - $Text.Length - 2) / 2)
    $rpad = [Math]::Max(0, 60 - $pad - $Text.Length - 1)
    $inner = (" " * $pad) + " $Text " + (" " * $rpad)
    Write-Host "║$inner║" -ForegroundColor Cyan
    Write-Host "╚$line╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-FSection {
    param($Text)
    Write-Host ""
    Write-Host "▶ $Text" -ForegroundColor Blue -NoNewline
    Write-Host ""
    Write-Host ("─" * 54) -ForegroundColor DarkGray
}

function Write-FBanner {
    param($AppName, $Version = "")
    $line = "═" * 60
    Write-Host ""
    Write-Host $line -ForegroundColor Cyan
    if ($Version) {
        Write-Host "  $AppName " -ForegroundColor Cyan -NoNewline
        Write-Host $Version -ForegroundColor Yellow
    } else {
        Write-Host "  $AppName" -ForegroundColor Cyan
    }
    Write-Host $line -ForegroundColor Cyan
    Write-Host ""
}

# Per-service log prefix colors
function Write-FLogFarasa   { param($Line) Write-Host "[FARASA  ] $Line" -ForegroundColor Cyan }
function Write-FLogPostgres { param($Line) Write-Host "[POSTGRES] $Line" -ForegroundColor Blue }
function Write-FLogStudio   { param($Line) Write-Host "[STUDIO  ] $Line" -ForegroundColor Magenta }
function Write-FLogTsc      { param($Line) Write-Host "[TSC     ] $Line" -ForegroundColor Yellow }
function Write-FLogLint     { param($Line) Write-Host "[LINT    ] $Line" -ForegroundColor DarkYellow }
function Write-FLogBuild    { param($Line) Write-Host "[BUILD   ] $Line" -ForegroundColor Green }

# ============================================================================
# State / PID Tracking
# ============================================================================

function Initialize-StateDir {
    if (-not (Test-Path $script:STATE_DIR)) {
        New-Item -ItemType Directory -Path $script:STATE_DIR | Out-Null
    }
}

function Register-Pid {
    param([int]$Pid, [string]$Name = "service")
    Initialize-StateDir
    Add-Content -Path $script:PIDS_FILE -Value "${Pid}:${Name}:$(Get-Date -UFormat %s)"
}

function Clear-StateFiles {
    Remove-Item -Path $script:PIDS_FILE -ErrorAction SilentlyContinue
    Remove-Item -Path "$($script:STATE_DIR)\farasa.lock" -ErrorAction SilentlyContinue
}

# ============================================================================
# Port Utilities
# ============================================================================

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

function Wait-ForPort {
    param([int]$Port, [string]$Name, [int]$TimeoutSec = 30)
    Write-FStep "Waiting for $Name on port $Port..."

    for ($i = 0; $i -lt $TimeoutSec; $i++) {
        if (Test-Port $Port) {
            Write-FSuccess "$Name is ready (port $Port)"
            return $true
        }
        if ($i % 5 -eq 0 -and $i -gt 0) {
            Write-FInfo "Still waiting... ($i/${TimeoutSec}s)"
        }
        Start-Sleep 1
    }

    Write-FFail "$Name did not start within ${TimeoutSec}s"
    return $false
}

function Stop-Port {
    param([int]$Port)
    $lines = netstat -ano 2>$null | Select-String ":$Port\s"
    foreach ($line in $lines) {
        if ($line -match "\s+(\d+)\s*$") {
            try { Stop-Process -Id $Matches[1] -Force -ErrorAction SilentlyContinue } catch { }
        }
    }
}

# ============================================================================
# Docker Utilities
# ============================================================================

function Test-DockerRunning {
    try {
        $null = docker info 2>&1
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Test-ComposeRunning {
    param([string]$ComposeFile)
    if (-not (Test-Path $ComposeFile)) { return $false }
    $out = docker compose -f $ComposeFile ps -q 2>$null
    return ($null -ne $out -and $out -ne "")
}

# ============================================================================
# Environment Utilities
# ============================================================================

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

# ============================================================================
# Dev Server (Native)
# ============================================================================

function Start-ServiceDev {
    Write-FSection "Next.js Dev Server"

    if (Test-Port $script:DEV_PORT) {
        Write-FSuccess "Dev server already running on :$($script:DEV_PORT)"
        return
    }

    Ensure-Directory "logs"

    Write-FStep "Starting bun dev..."
    $proc = Start-Process bun -ArgumentList "dev" `
        -WorkingDirectory $script:SCRIPT_DIR `
        -PassThru -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $script:SCRIPT_DIR "logs\dev.log") `
        -RedirectStandardError  (Join-Path $script:SCRIPT_DIR "logs\dev-err.log")

    Register-Pid $proc.Id "farasa-dev"
    Write-FInfo "Dev server starting (PID: $($proc.Id)) → logs\dev.log"

    $null = Wait-ForPort $script:DEV_PORT "Next.js dev server" 45
}

function Stop-ServiceDev {
    Write-FSection "Stopping Dev Server"
    if (Test-Port $script:DEV_PORT) {
        Stop-Port $script:DEV_PORT
        Write-FSuccess "Dev server stopped"
    } else {
        Write-FInfo "Dev server is not running"
    }
}

function Follow-DevLogs {
    $logPath = Join-Path $script:SCRIPT_DIR "logs\dev.log"
    if (-not (Test-Path $logPath)) {
        Write-FWarning "No dev log found yet"
        return
    }
    Write-FInfo "Following dev server logs... (Ctrl+C to stop)"
    Write-Host ""
    Get-Content $logPath -Wait | ForEach-Object { Write-FLogFarasa $_ }
}

function Follow-PostgresLogs {
    if (-not (Test-Path $script:COMPOSE_DEV)) {
        Write-FFail "Docker Compose file not found: $($script:COMPOSE_DEV)"
        return
    }
    Write-FInfo "Following PostgreSQL logs... (Ctrl+C to stop)"
    Write-Host ""
    docker compose -f $script:COMPOSE_DEV logs -f --tail=50 postgres 2>&1 | ForEach-Object {
        Write-FLogPostgres $_
    }
}

function Follow-StudioLogs {
    $logPath = Join-Path $script:SCRIPT_DIR "logs\studio.log"
    if (-not (Test-Path $logPath)) {
        Write-FWarning "No studio log found yet"
        return
    }
    Write-FInfo "Following Drizzle Studio logs... (Ctrl+C to stop)"
    Write-Host ""
    Get-Content $logPath -Wait | ForEach-Object { Write-FLogStudio $_ }
}

function Follow-AllLogs {
    Write-FSection "Following All Logs (Ctrl+C to stop)"
    Write-Host ""

    $devLog    = Join-Path $script:SCRIPT_DIR "logs\dev.log"
    $studioLog = Join-Path $script:SCRIPT_DIR "logs\studio.log"

    $jobDev    = $null
    $jobStudio = $null

    if (Test-Path $devLog) {
        $jobDev = Start-Job -ScriptBlock { param($p) Get-Content $p -Wait } -ArgumentList $devLog
    }
    if (Test-Path $studioLog) {
        $jobStudio = Start-Job -ScriptBlock { param($p) Get-Content $p -Wait } -ArgumentList $studioLog
    }

    if (-not $jobDev -and -not $jobStudio) {
        Write-FWarning "No log files found yet"
        return
    }

    Write-FInfo "Streaming all logs... (Ctrl+C to stop)"
    try {
        while ($true) {
            if ($jobDev)    { Receive-Job $jobDev    | ForEach-Object { Write-Host "[FARASA  ] $_" -ForegroundColor Cyan } }
            if ($jobStudio) { Receive-Job $jobStudio | ForEach-Object { Write-Host "[STUDIO  ] $_" -ForegroundColor Magenta } }
            Start-Sleep -Milliseconds 200
        }
    } finally {
        if ($jobDev)    { Stop-Job $jobDev    -ErrorAction SilentlyContinue; Remove-Job $jobDev    -ErrorAction SilentlyContinue }
        if ($jobStudio) { Stop-Job $jobStudio -ErrorAction SilentlyContinue; Remove-Job $jobStudio -ErrorAction SilentlyContinue }
    }
}

# ============================================================================
# Postgres Service (Docker)
# ============================================================================

function Start-ServicePostgres {
    Write-FSection "PostgreSQL (Docker)"

    if (-not (Test-DockerRunning)) {
        Write-FFail "Docker is not running. Please start Docker Desktop."
        return $false
    }

    if (-not (Test-Path $script:COMPOSE_DEV)) {
        Write-FFail "Docker Compose file not found: $($script:COMPOSE_DEV)"
        return $false
    }

    $running = docker compose -f $script:COMPOSE_DEV ps -q postgres 2>$null
    if ($running) {
        Write-FSuccess "PostgreSQL container already running"
        return $true
    }

    Write-FStep "Starting PostgreSQL container..."
    docker compose -f $script:COMPOSE_DEV up -d postgres 2>&1 | ForEach-Object {
        Write-FLogPostgres $_
    }

    # Wait for health
    Write-FStep "Waiting for PostgreSQL to accept connections..."
    for ($i = 0; $i -lt 30; $i++) {
        $ready = docker exec farasa-postgres pg_isready -U farasa_user -d farasa_db 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-FSuccess "PostgreSQL is ready on :$($script:POSTGRES_PORT)"
            return $true
        }
        if ($i % 5 -eq 0 -and $i -gt 0) { Write-FInfo "Still waiting... ($i/30s)" }
        Start-Sleep 1
    }

    Write-FFail "PostgreSQL did not become ready in 30s"
    return $false
}

function Stop-ServicePostgres {
    Write-FSection "Stopping PostgreSQL"
    if (Test-Path $script:COMPOSE_DEV) {
        docker compose -f $script:COMPOSE_DEV stop postgres 2>$null
        Write-FSuccess "PostgreSQL stopped"
    } else {
        Write-FInfo "PostgreSQL container is not running"
    }
}

# ============================================================================
# Drizzle Studio (Native)
# ============================================================================

function Start-ServiceStudio {
    Write-FSection "Drizzle Studio"

    if (Test-Port $script:STUDIO_PORT) {
        Write-FSuccess "Drizzle Studio already running on :$($script:STUDIO_PORT)"
        return
    }

    Ensure-Directory "logs"

    $proc = Start-Process bun -ArgumentList "db:studio" `
        -WorkingDirectory $script:SCRIPT_DIR `
        -PassThru -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $script:SCRIPT_DIR "logs\studio.log")

    Register-Pid $proc.Id "drizzle-studio"
    Start-Sleep 3

    if (Test-Port $script:STUDIO_PORT) {
        Write-FSuccess "Drizzle Studio is ready → http://local.drizzle.studio"
    } else {
        Write-FInfo "Drizzle Studio starting → http://local.drizzle.studio"
    }
}

# ============================================================================
# Full Docker Stack
# ============================================================================

function Start-DockerStack {
    Write-FHeader "Starting Farasa Full Docker Stack"

    if (-not (Test-DockerRunning)) {
        Write-FFail "Docker is not running. Please start Docker Desktop."
        return
    }

    if (-not (Test-Path $script:COMPOSE_PROD)) {
        Write-FFail "Docker Compose file not found: $($script:COMPOSE_PROD)"
        return
    }

    $env:COMPOSE_DOCKER_CLI_BUILD = "1"
    $env:DOCKER_BUILDKIT = "1"

    Write-FStep "Building and starting all containers..."
    docker compose -f $script:COMPOSE_PROD up -d --build

    if ($LASTEXITCODE -eq 0) {
        $null = Wait-ForPort $script:DEV_PORT "Farasa app" 60
        Write-FSuccess "Full Docker stack running → http://localhost:$($script:DEV_PORT)"
    } else {
        Write-FFail "Failed to start Docker stack"
    }
}

function Stop-DockerStack {
    Write-FHeader "Stopping Farasa Docker Stack"
    if (Test-Path $script:COMPOSE_PROD) {
        docker compose -f $script:COMPOSE_PROD down --timeout 15
        Write-FSuccess "Docker stack stopped"
    } else {
        Write-FWarning "No Docker Compose file found"
    }
}

# ============================================================================
# Hybrid Stack
# ============================================================================

function Start-HybridStack {
    Write-FHeader "Starting Farasa Hybrid Stack"
    Write-FInfo "Mode: Docker Postgres + Native Next.js dev server"
    Write-Host ""

    if (-not (Start-ServicePostgres)) { return }
    Write-Host ""
    Start-ServiceDev

    Write-Host ""
    Write-FSuccess "Hybrid stack running!"
    Write-Host ""
    Write-Host "  App:      " -NoNewline; Write-Host "http://localhost:$($script:DEV_PORT)" -ForegroundColor Cyan
    Write-Host "  Postgres: " -NoNewline; Write-Host "localhost:$($script:POSTGRES_PORT)" -ForegroundColor Blue
    Write-Host ""
}

# ============================================================================
# Post-Start Prompt
# ============================================================================

function Show-PostStartPrompt {
    Write-Host ""
    Write-FSuccess "Services started!"
    Write-Host ""
    Write-Host "  " -NoNewline; Write-Host "l)" -ForegroundColor Yellow -NoNewline
    Write-Host " Follow logs " -NoNewline; Write-Host "(colored, live)" -ForegroundColor Green
    Write-Host "  " -NoNewline; Write-Host "s)" -ForegroundColor Yellow -NoNewline; Write-Host " Show status"
    Write-Host "  " -NoNewline; Write-Host "Enter)" -ForegroundColor Yellow -NoNewline; Write-Host " Return to menu"
    Write-Host ""

    $choice = Read-Host "Choice"
    switch ($choice.ToLower()) {
        "l" { Follow-DevLogs }
        "s" { Show-ServiceStatus; Read-Host "Press Enter to continue" }
    }
}

# ============================================================================
# Stop All (Docker-aware)
# ============================================================================

function Stop-All {
    Write-FHeader "Stopping All Services"

    $dockerWasRunning = $false

    if (Test-DockerRunning) {
        foreach ($cf in @($script:COMPOSE_DEV, $script:COMPOSE_PROD)) {
            if (Test-ComposeRunning $cf) {
                $dockerWasRunning = $true
                Write-FStep "Stopping Docker containers ($cf)..."
                docker compose -f $cf down --timeout 10 2>$null
            }
        }
    }

    Stop-ServiceDev
    if (Test-Port $script:STUDIO_PORT) { Stop-Port $script:STUDIO_PORT }

    Clear-StateFiles
    Write-FSuccess "All services stopped"
}

# ============================================================================
# Database Commands
# ============================================================================

function Invoke-DbMigrate {
    Write-FSection "Database Migrations"
    Write-FStep "Running: bun db:migrate"
    Write-Host ""
    bun db:migrate 2>&1 | ForEach-Object { Write-FLogFarasa $_ }
    if ($LASTEXITCODE -eq 0) { Write-FSuccess "Migrations complete" }
    else { Write-FFail "Migration failed" }
}

function Invoke-DbGenerate {
    Write-FSection "Generate Migrations"
    Write-FStep "Running: bun db:generate"
    Write-Host ""
    bun db:generate 2>&1 | ForEach-Object { Write-FLogFarasa $_ }
    if ($LASTEXITCODE -eq 0) { Write-FSuccess "Migration files generated" }
    else { Write-FFail "Generate failed" }
}

function Invoke-DbPush {
    Write-FSection "Push Schema"
    Write-FStep "Running: bun db:push"
    Write-Host ""
    bun db:push 2>&1 | ForEach-Object { Write-FLogFarasa $_ }
    if ($LASTEXITCODE -eq 0) { Write-FSuccess "Schema pushed" }
    else { Write-FFail "Push failed" }
}

# ============================================================================
# Code Quality Commands
# ============================================================================

function Invoke-TypeCheck {
    Write-FSection "TypeScript Type Check"
    Write-FStep "Running: bun type-check"
    Write-Host ""
    bun type-check 2>&1 | ForEach-Object { Write-FLogTsc $_ }
    if ($LASTEXITCODE -eq 0) { Write-FSuccess "Type check passed" }
    else { Write-FFail "Type check failed" }
    return $LASTEXITCODE
}

function Invoke-Lint {
    Write-FSection "ESLint"
    Write-FStep "Running: bun lint"
    Write-Host ""
    bun lint 2>&1 | ForEach-Object { Write-FLogLint $_ }
    if ($LASTEXITCODE -eq 0) { Write-FSuccess "Lint passed" }
    else { Write-FFail "Lint failed" }
    return $LASTEXITCODE
}

function Invoke-Build {
    Write-FSection "Production Build"
    Write-FStep "Running: bun build"
    Write-Host ""
    bun run build 2>&1 | ForEach-Object { Write-FLogBuild $_ }
    if ($LASTEXITCODE -eq 0) { Write-FSuccess "Build complete" }
    else { Write-FFail "Build failed" }
    return $LASTEXITCODE
}

# ============================================================================
# Environment Validation
# ============================================================================

function Invoke-ValidateEnv {
    Write-FSection "Environment Validation"

    $envFile = Join-Path $script:SCRIPT_DIR ".env"
    $missing = 0

    if (-not (Test-Path $envFile)) {
        Write-FFail ".env file not found"
        Write-FInfo "Copy .env.example to .env and fill in your credentials"
        return $false
    }

    Write-FSuccess ".env file found"

    $requiredVars = @(
        "AUTH_SECRET",
        "AUTH_GOOGLE_ID",
        "AUTH_GOOGLE_SECRET",
        "OPENROUTER_API_KEY",
        "DATABASE_URL"
    )

    $envContent = Get-Content $envFile
    foreach ($var in $requiredVars) {
        $line = $envContent | Where-Object { $_ -match "^${var}=(.+)$" }
        $value = if ($line) { ($line -split "=", 2)[1].Trim().Trim('"').Trim("'") } else { "" }

        if ([string]::IsNullOrWhiteSpace($value)) {
            Write-FFail "Missing or empty: $var"
            $missing++
        } else {
            Write-FSuccess "  ${var} is set"
        }
    }

    $optionalVars = @("TAVILY_API_KEY", "GCS_BUCKET_NAME", "GCS_PROJECT_ID", "NEXT_PUBLIC_APP_URL")
    Write-Host ""
    Write-FInfo "Optional variables:"
    foreach ($var in $optionalVars) {
        $line = $envContent | Where-Object { $_ -match "^${var}=(.+)$" }
        $value = if ($line) { ($line -split "=", 2)[1].Trim().Trim('"').Trim("'") } else { "" }
        if ([string]::IsNullOrWhiteSpace($value)) {
            Write-FWarning "  ${var} not set (optional)"
        } else {
            Write-FSuccess "  ${var} is set"
        }
    }

    Write-Host ""
    if ($missing -gt 0) {
        Write-FFail "$missing required variable(s) are missing"
        return $false
    }

    Write-FSuccess "All required environment variables are set"
    return $true
}

# ============================================================================
# Service Status
# ============================================================================

function Show-ServiceStatus {
    Write-FHeader "Service Status"

    Write-Host "Native Services:" -ForegroundColor White
    $devStatus = if (Test-Port $script:DEV_PORT) { "● Running  → http://localhost:$($script:DEV_PORT)" } else { "○ Stopped" }
    $devColor  = if (Test-Port $script:DEV_PORT) { "Green" } else { "DarkGray" }
    Write-Host "  Next.js dev  ($($script:DEV_PORT)):    " -NoNewline
    Write-Host $devStatus -ForegroundColor $devColor

    $studioStatus = if (Test-Port $script:STUDIO_PORT) { "● Running  → http://local.drizzle.studio" } else { "○ Stopped" }
    $studioColor  = if (Test-Port $script:STUDIO_PORT) { "Green" } else { "DarkGray" }
    Write-Host "  Drizzle Studio ($($script:STUDIO_PORT)): " -NoNewline
    Write-Host $studioStatus -ForegroundColor $studioColor

    Write-Host ""
    Write-Host "Docker Containers:" -ForegroundColor White

    if (Test-DockerRunning) {
        $pgRunning = (docker ps --format "{{.Names}}" 2>$null) -contains "farasa-postgres"
        $pgStatus = if ($pgRunning) { "● Running  → localhost:$($script:POSTGRES_PORT)" } else { "○ Stopped" }
        $pgColor  = if ($pgRunning) { "Green" } else { "DarkGray" }
        Write-Host "  PostgreSQL:                " -NoNewline
        Write-Host $pgStatus -ForegroundColor $pgColor

        $adRunning = (docker ps --format "{{.Names}}" 2>$null) -contains "farasa-adminer"
        $adStatus = if ($adRunning) { "● Running  → http://localhost:$($script:ADMINER_PORT)" } else { "○ Stopped" }
        $adColor  = if ($adRunning) { "Green" } else { "DarkGray" }
        Write-Host "  Adminer:                   " -NoNewline
        Write-Host $adStatus -ForegroundColor $adColor
    } else {
        Write-Host "  Docker not running" -ForegroundColor DarkGray
    }

    Write-Host ""
}

# ============================================================================
# Advanced Utilities
# ============================================================================

function Show-TrackedProcesses {
    Write-FSection "Tracked Processes"
    if (-not (Test-Path $script:PIDS_FILE)) {
        Write-FInfo "No tracked processes found"
        return
    }
    $lines = Get-Content $script:PIDS_FILE -ErrorAction SilentlyContinue
    if (-not $lines -or $lines.Count -eq 0) {
        Write-FInfo "No tracked processes found"
        return
    }
    foreach ($line in $lines) {
        $parts = $line -split ":"
        if ($parts.Count -ge 2) {
            $procId   = $parts[0]
            $procName = $parts[1]
            $proc     = Get-Process -Id $procId -ErrorAction SilentlyContinue
            $status   = if ($proc) { "Running" } else { "Stopped" }
            $color    = if ($proc) { "Green" }   else { "DarkGray" }
            Write-Host "  PID $procId ($procName): " -NoNewline
            Write-Host $status -ForegroundColor $color
        }
    }
}

function Start-ServiceAdminer {
    if (-not (Test-DockerRunning)) {
        Write-FFail "Docker is not running. Please start Docker Desktop."
        return
    }
    if (-not (Test-Path $script:COMPOSE_DEV)) {
        Write-FFail "Docker Compose file not found: $($script:COMPOSE_DEV)"
        return
    }
    Write-FStep "Starting Adminer..."
    docker compose -f $script:COMPOSE_DEV up -d adminer 2>&1 | ForEach-Object { Write-FLogPostgres $_ }
    Write-FSuccess "Adminer → http://localhost:$($script:ADMINER_PORT)"
    Write-FInfo "  Server: postgres | User: farasa_user | DB: farasa_db"
}

# ============================================================================
# Logs Submenu
# ============================================================================

function Show-LogsMenu {
    while ($true) {
        Clear-Host
        Write-FHeader "Logs — Farasa"

        Write-Host "  " -NoNewline; Write-Host "1)" -ForegroundColor Yellow -NoNewline
        Write-Host " Follow Dev Server     " -NoNewline; Write-Host "live, cyan prefix" -ForegroundColor DarkGray
        Write-Host "  " -NoNewline; Write-Host "2)" -ForegroundColor Yellow -NoNewline
        Write-Host " Follow Postgres       " -NoNewline; Write-Host "live, blue prefix (Docker)" -ForegroundColor DarkGray
        Write-Host "  " -NoNewline; Write-Host "3)" -ForegroundColor Yellow -NoNewline
        Write-Host " Follow Studio         " -NoNewline; Write-Host "live, magenta prefix" -ForegroundColor DarkGray
        Write-Host "  " -NoNewline; Write-Host "4)" -ForegroundColor Yellow -NoNewline
        Write-Host " Follow All Logs       " -NoNewline; Write-Host "all services combined" -ForegroundColor DarkGray
        Write-Host "  " -NoNewline; Write-Host "5)" -ForegroundColor Yellow -NoNewline
        Write-Host " Last 100 Lines        " -NoNewline; Write-Host "dev server" -ForegroundColor DarkGray
        Write-Host "  " -NoNewline; Write-Host "0)" -ForegroundColor Yellow -NoNewline; Write-Host " Back"
        Write-Host ""

        $choice = Read-Host "Choice [0-5]"
        switch ($choice) {
            "1" { Follow-DevLogs }
            "2" { Follow-PostgresLogs; Read-Host "Press Enter to continue" }
            "3" { Follow-StudioLogs }
            "4" { Follow-AllLogs }
            "5" {
                $logPath = Join-Path $script:SCRIPT_DIR "logs\dev.log"
                if (Test-Path $logPath) {
                    Get-Content $logPath -Tail 100 | ForEach-Object { Write-FLogFarasa $_ }
                } else {
                    Write-FWarning "No dev log found yet"
                }
                Read-Host "Press Enter to continue"
            }
            "0" { return }
            default { Write-FFail "Invalid option"; Start-Sleep 1 }
        }
    }
}

# ============================================================================
# Advanced Submenu
# ============================================================================

function Show-AdvancedMenu {
    while ($true) {
        Clear-Host
        Write-FHeader "Advanced — Farasa"

        Write-Host "  " -NoNewline; Write-Host "1)" -ForegroundColor Yellow -NoNewline; Write-Host " Force Cleanup All Processes"
        Write-Host "  " -NoNewline; Write-Host "2)" -ForegroundColor Yellow -NoNewline; Write-Host " Show Tracked Processes"
        Write-Host "  " -NoNewline; Write-Host "3)" -ForegroundColor Yellow -NoNewline; Write-Host " Validate Environment"
        Write-Host "  " -NoNewline; Write-Host "4)" -ForegroundColor Yellow -NoNewline; Write-Host " Start Adminer (DB GUI)"
        Write-Host "  " -NoNewline; Write-Host "0)" -ForegroundColor Yellow -NoNewline; Write-Host " Back"
        Write-Host ""

        $choice = Read-Host "Choice [0-4]"
        switch ($choice) {
            "1" {
                Write-FHeader "Force Cleanup"
                if (Test-DockerRunning) {
                    foreach ($cf in @($script:COMPOSE_DEV, $script:COMPOSE_PROD)) {
                        if (Test-Path $cf) { docker compose -f $cf down --timeout 10 2>$null }
                    }
                }
                Stop-Port $script:DEV_PORT
                Stop-Port $script:STUDIO_PORT
                Clear-StateFiles
                Write-FSuccess "Cleanup complete"
                Read-Host "Press Enter to continue"
            }
            "2" { Show-TrackedProcesses; Read-Host "Press Enter to continue" }
            "3" { $null = Invoke-ValidateEnv; Read-Host "Press Enter to continue" }
            "4" { Start-ServiceAdminer; Read-Host "Press Enter to continue" }
            "0" { return }
            default { Write-FFail "Invalid option"; Start-Sleep 1 }
        }
    }
}

# ============================================================================
# Interactive Menu
# ============================================================================

function Show-MainMenu {
    while ($true) {
        Clear-Host
        Write-FBanner "Farasa" "v${script:VERSION}"

        Write-Host "Development" -ForegroundColor White
        Write-Host "───────────" -ForegroundColor DarkGray
        Write-Host "  " -NoNewline; Write-Host "1)" -ForegroundColor Yellow -NoNewline
        Write-Host " Start Services     " -NoNewline; Write-Host "native / hybrid / docker" -ForegroundColor DarkGray
        Write-Host "  " -NoNewline; Write-Host "2)" -ForegroundColor Yellow -NoNewline
        Write-Host " Stop All Services"
        Write-Host "  " -NoNewline; Write-Host "3)" -ForegroundColor Yellow -NoNewline
        Write-Host " Follow Logs        " -NoNewline; Write-Host "live colored output" -ForegroundColor DarkGray
        Write-Host ""

        Write-Host "Database" -ForegroundColor White
        Write-Host "────────" -ForegroundColor DarkGray
        Write-Host "  " -NoNewline; Write-Host "4)" -ForegroundColor Yellow -NoNewline
        Write-Host " Database Operations" -NoNewline; Write-Host " migrate / generate / push / studio" -ForegroundColor DarkGray
        Write-Host ""

        Write-Host "Code Quality" -ForegroundColor White
        Write-Host "────────────" -ForegroundColor DarkGray
        Write-Host "  " -NoNewline; Write-Host "5)" -ForegroundColor Yellow -NoNewline
        Write-Host " Quality Checks     " -NoNewline; Write-Host "typecheck / lint / build" -ForegroundColor DarkGray
        Write-Host ""

        Write-Host "System" -ForegroundColor White
        Write-Host "──────" -ForegroundColor DarkGray
        Write-Host "  " -NoNewline; Write-Host "s)" -ForegroundColor Yellow -NoNewline; Write-Host " Status"
        Write-Host "  " -NoNewline; Write-Host "v)" -ForegroundColor Yellow -NoNewline; Write-Host " Validate Environment"
        Write-Host "  " -NoNewline; Write-Host "x)" -ForegroundColor Yellow -NoNewline; Write-Host " Advanced"
        Write-Host "  " -NoNewline; Write-Host "0)" -ForegroundColor Yellow -NoNewline; Write-Host " Exit"
        Write-Host ""

        $choice = Read-Host "Select option"

        switch ($choice.ToLower()) {
            "1" { Show-StartMenu }
            "2" {
                $confirm = Read-Host "Stop all running services? [Y/n]"
                if ($confirm -ne "n" -and $confirm -ne "N") { Stop-All }
                Read-Host "Press Enter to continue"
            }
            "3" { Show-LogsMenu }
            "4" { Show-DatabaseMenu }
            "5" { Show-QualityMenu }
            "s" { Show-ServiceStatus; Read-Host "Press Enter to continue" }
            "v" { $null = Invoke-ValidateEnv; Read-Host "Press Enter to continue" }
            "x" { Show-AdvancedMenu }
            "0" { Write-FInfo "Goodbye!"; exit 0 }
            default { Write-FFail "Invalid option"; Start-Sleep 1 }
        }
    }
}

function Show-StartMenu {
    while ($true) {
        Clear-Host
        Write-FHeader "Start Services — Farasa"

        Write-Host "  " -NoNewline; Write-Host "1)" -ForegroundColor Yellow -NoNewline
        Write-Host " Native Mode       " -NoNewline; Write-Host "bun dev → http://localhost:$($script:DEV_PORT)" -ForegroundColor DarkGray
        Write-Host "  " -NoNewline; Write-Host "2)" -ForegroundColor Yellow -NoNewline
        Write-Host " Hybrid Mode       " -NoNewline; Write-Host "Docker Postgres + native bun dev" -ForegroundColor DarkGray
        Write-Host "  " -NoNewline; Write-Host "3)" -ForegroundColor Yellow -NoNewline
        Write-Host " Full Docker Mode  " -NoNewline; Write-Host "Everything containerized" -ForegroundColor DarkGray
        Write-Host "  " -NoNewline; Write-Host "0)" -ForegroundColor Yellow -NoNewline; Write-Host " Back"
        Write-Host ""

        $choice = Read-Host "Choice [0-3]"
        switch ($choice) {
            "1" { Start-ServiceDev; Show-PostStartPrompt }
            "2" { Start-HybridStack; Show-PostStartPrompt }
            "3" { Start-DockerStack; Show-PostStartPrompt }
            "0" { return }
            default { Write-FFail "Invalid option"; Start-Sleep 1 }
        }
    }
}

function Show-DatabaseMenu {
    while ($true) {
        Clear-Host
        Write-FHeader "Database — Farasa"

        Write-Host "  " -NoNewline; Write-Host "1)" -ForegroundColor Yellow -NoNewline; Write-Host " Run Migrations      " -NoNewline; Write-Host "bun db:migrate" -ForegroundColor DarkGray
        Write-Host "  " -NoNewline; Write-Host "2)" -ForegroundColor Yellow -NoNewline; Write-Host " Generate Migrations " -NoNewline; Write-Host "bun db:generate" -ForegroundColor DarkGray
        Write-Host "  " -NoNewline; Write-Host "3)" -ForegroundColor Yellow -NoNewline; Write-Host " Push Schema         " -NoNewline; Write-Host "bun db:push" -ForegroundColor DarkGray
        Write-Host "  " -NoNewline; Write-Host "4)" -ForegroundColor Yellow -NoNewline; Write-Host " Open Drizzle Studio " -NoNewline; Write-Host "http://local.drizzle.studio" -ForegroundColor DarkGray
        Write-Host "  " -NoNewline; Write-Host "0)" -ForegroundColor Yellow -NoNewline; Write-Host " Back"
        Write-Host ""

        $choice = Read-Host "Choice [0-4]"
        switch ($choice) {
            "1" { Invoke-DbMigrate; Read-Host "Press Enter to continue" }
            "2" { Invoke-DbGenerate; Read-Host "Press Enter to continue" }
            "3" { Invoke-DbPush; Read-Host "Press Enter to continue" }
            "4" { Start-ServiceStudio; Read-Host "Press Enter to continue" }
            "0" { return }
            default { Write-FFail "Invalid option"; Start-Sleep 1 }
        }
    }
}

function Show-QualityMenu {
    while ($true) {
        Clear-Host
        Write-FHeader "Code Quality — Farasa"

        Write-Host "  " -NoNewline; Write-Host "1)" -ForegroundColor Yellow -NoNewline; Write-Host " Type Check       " -NoNewline; Write-Host "bun type-check" -ForegroundColor DarkGray
        Write-Host "  " -NoNewline; Write-Host "2)" -ForegroundColor Yellow -NoNewline; Write-Host " Lint             " -NoNewline; Write-Host "bun lint" -ForegroundColor DarkGray
        Write-Host "  " -NoNewline; Write-Host "3)" -ForegroundColor Yellow -NoNewline; Write-Host " Production Build " -NoNewline; Write-Host "bun build" -ForegroundColor DarkGray
        Write-Host "  " -NoNewline; Write-Host "4)" -ForegroundColor Yellow -NoNewline; Write-Host " All Checks       " -NoNewline; Write-Host "type-check + lint" -ForegroundColor DarkGray
        Write-Host "  " -NoNewline; Write-Host "0)" -ForegroundColor Yellow -NoNewline; Write-Host " Back"
        Write-Host ""

        $choice = Read-Host "Choice [0-4]"
        switch ($choice) {
            "1" { $null = Invoke-TypeCheck; Read-Host "Press Enter to continue" }
            "2" { $null = Invoke-Lint; Read-Host "Press Enter to continue" }
            "3" { $null = Invoke-Build; Read-Host "Press Enter to continue" }
            "4" {
                $null = Invoke-TypeCheck
                Write-Host ""
                $null = Invoke-Lint
                Read-Host "Press Enter to continue"
            }
            "0" { return }
            default { Write-FFail "Invalid option"; Start-Sleep 1 }
        }
    }
}

# ============================================================================
# Help Text
# ============================================================================

function Show-Help {
    Write-Host ""
    Write-Host "Farasa v${script:VERSION}" -ForegroundColor Cyan -NoNewline
    Write-Host " — Development management script (Windows)"
    Write-Host ""
    Write-Host "Usage: " -NoNewline; Write-Host ".\start.ps1 [command]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Development:" -ForegroundColor White
    Write-Host "  dev              Start dev server (native, port $($script:DEV_PORT))"
    Write-Host "  dev:hybrid       Start hybrid mode (Docker postgres + native dev)"
    Write-Host "  dev:docker       Start full Docker stack"
    Write-Host "  stop             Stop all services"
    Write-Host "  status           Show service status"
    Write-Host "  logs             Follow dev server logs (colored)"
    Write-Host ""
    Write-Host "Database:" -ForegroundColor White
    Write-Host "  db:migrate       Run database migrations"
    Write-Host "  db:generate      Generate migration files"
    Write-Host "  db:push          Push schema to database"
    Write-Host "  db:studio        Open Drizzle Studio (port $($script:STUDIO_PORT))"
    Write-Host ""
    Write-Host "Code Quality:" -ForegroundColor White
    Write-Host "  typecheck        TypeScript type check"
    Write-Host "  lint             ESLint"
    Write-Host "  build            Production build"
    Write-Host ""
    Write-Host "System:" -ForegroundColor White
    Write-Host "  validate         Validate .env configuration"
    Write-Host "  cleanup          Force cleanup all processes"
    Write-Host ""
    Write-Host "Without arguments, launches interactive menu." -ForegroundColor DarkGray
    Write-Host ""
}

# ============================================================================
# Main Entry Point
# ============================================================================

Set-Location $script:SCRIPT_DIR
Initialize-StateDir

switch ($Command.ToLower()) {
    ""           { Show-MainMenu }
    "dev"        { Start-ServiceDev }
    "dev:hybrid" { Start-HybridStack }
    "dev:docker" { Start-DockerStack }
    "stop"       { Stop-All }
    "status"     { Show-ServiceStatus }
    "logs"       { Follow-DevLogs }
    "db:migrate" { Invoke-DbMigrate }
    "db:generate"{ Invoke-DbGenerate }
    "db:push"    { Invoke-DbPush }
    "db:studio"  { Start-ServiceStudio }
    { $_ -in "typecheck","type-check" } { $null = Invoke-TypeCheck }
    "lint"       { $null = Invoke-Lint }
    "build"      { $null = Invoke-Build }
    "validate"   { $null = Invoke-ValidateEnv }
    "cleanup"    {
        Write-FHeader "Force Cleanup"
        if (Test-DockerRunning) {
            foreach ($cf in @($script:COMPOSE_DEV, $script:COMPOSE_PROD)) {
                if (Test-Path $cf) { docker compose -f $cf down --timeout 10 2>$null }
            }
        }
        Stop-Port $script:DEV_PORT
        Stop-Port $script:STUDIO_PORT
        Clear-StateFiles
        Write-FSuccess "Cleanup complete"
    }
    { $_ -in "--help","-h","help" } { Show-Help }
    default {
        Write-FFail "Unknown command: $Command"
        Write-Host "Run '.\start.ps1 --help' for usage"
        exit 1
    }
}
