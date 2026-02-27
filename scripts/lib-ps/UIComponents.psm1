# UIComponents.psm1 — Farasa PowerShell UI Library
# Progress bars, banners, prompts

function Write-FHeader {
    param($Text)
    $line = "═" * 60
    $pad  = [Math]::Max(0, (60 - $Text.Length - 2) / 2)
    $rpad = [Math]::Max(0, 60 - $pad - $Text.Length - 1)
    $inner = (" " * $pad) + " $Text " + (" " * $rpad)
    Write-Host ""
    Write-Host "╔$line╗" -ForegroundColor Cyan
    Write-Host "║$inner║" -ForegroundColor Cyan
    Write-Host "╚$line╝" -ForegroundColor Cyan
    Write-Host ""
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

function Write-FSection {
    param($Text)
    Write-Host ""
    Write-Host "▶ $Text" -ForegroundColor Blue
    Write-Host ("─" * 54) -ForegroundColor DarkGray
}

function Show-ProgressBar {
    param([int]$Current, [int]$Total, [string]$Label = "Progress", [int]$Width = 40)
    $pct     = [Math]::Round(($Current / $Total) * 100, 1)
    $filled  = [Math]::Round(($Current / $Total) * $Width)
    $bar     = ("█" * $filled) + ("░" * ($Width - $filled))
    Write-Host "`r$Label [$bar] $pct% ($Current/$Total)" -NoNewline -ForegroundColor Cyan
    if ($Current -eq $Total) { Write-Host "" }
}

function Confirm-Prompt {
    param([string]$Message, [string]$Default = "n")
    $hint = if ($Default -eq "y") { "[Y/n]" } else { "[y/N]" }
    $response = Read-Host "$Message $hint"
    if ([string]::IsNullOrWhiteSpace($response)) { $response = $Default }
    return $response.ToLower() -in @("y", "yes")
}

Export-ModuleMember -Function *
