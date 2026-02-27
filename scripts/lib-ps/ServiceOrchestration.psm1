# ServiceOrchestration.psm1 — Farasa PowerShell Service Orchestration
# Delegates to the main start.ps1 which contains all service logic.
# This module exists for composability when building additional scripts.

# Re-export key constants used by external scripts
$script:DEV_PORT      = 3000
$script:STUDIO_PORT   = 4983
$script:POSTGRES_PORT = 5432
$script:COMPOSE_DEV   = "docker\docker-compose.dev.yml"
$script:COMPOSE_PROD  = "docker\docker-compose.yml"

function Get-ServicePorts {
    return @{
        Dev      = $script:DEV_PORT
        Studio   = $script:STUDIO_PORT
        Postgres = $script:POSTGRES_PORT
    }
}

Export-ModuleMember -Function * -Variable *
