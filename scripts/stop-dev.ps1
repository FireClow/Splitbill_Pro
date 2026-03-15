$ErrorActionPreference = 'SilentlyContinue'

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot 'backend'
$frontendDir = Join-Path $repoRoot 'frontend'
$backendPidFile = Join-Path $PSScriptRoot '.backend.pid'
$frontendPidFile = Join-Path $PSScriptRoot '.frontend.pid'

function Stop-PidFromFile {
    param(
        [string]$PidFile,
        [string]$Label
    )

    if (Test-Path $PidFile) {
        $pidValue = Get-Content $PidFile -Raw
        if ($pidValue) {
            Stop-Process -Id ([int]$pidValue) -Force
            Write-Host "[$Label] Stopped PID $pidValue" -ForegroundColor Green
        }
        Remove-Item $PidFile -Force
    }
}

Stop-PidFromFile -PidFile $backendPidFile -Label 'Backend'
Stop-PidFromFile -PidFile $frontendPidFile -Label 'Frontend'

Get-CimInstance Win32_Process -Filter "name='python.exe'" |
    Where-Object { $_.CommandLine -match 'uvicorn server:app' -and $_.CommandLine -match [regex]::Escape($backendDir) } |
    ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force
        Write-Host "[Backend] Stopped uvicorn PID $($_.ProcessId)" -ForegroundColor Green
    }

Get-CimInstance Win32_Process -Filter "name='node.exe'" |
    Where-Object { $_.CommandLine -match 'expo start --web' -and $_.CommandLine -match [regex]::Escape($frontendDir) } |
    ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force
        Write-Host "[Frontend] Stopped Expo PID $($_.ProcessId)" -ForegroundColor Green
    }

Write-Host '[Done] Stop command finished.' -ForegroundColor White
