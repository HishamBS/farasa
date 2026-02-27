# ServiceOrchestration.psm1 — Farasa PowerShell Service Orchestration
# Delegates to the main start.ps1 which contains all service logic.
# This module exists for composability when building additional scripts.

function Get-ServicePorts {
    return @{
        Dev      = $script:DEV_PORT
        Studio   = $script:STUDIO_PORT
        Postgres = $script:POSTGRES_PORT
    }
}

Export-ModuleMember -Function * -Variable *
