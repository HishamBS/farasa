@echo off
:: Farasa Platform Management Script — Windows Launcher
:: Delegates to start.ps1 via PowerShell
::
:: Usage:
::   start.bat                  Launch interactive menu
::   start.bat dev              Start dev server
::   start.bat stop             Stop all services
::   start.bat status           Show service status
::   start.bat --help           Show help

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
