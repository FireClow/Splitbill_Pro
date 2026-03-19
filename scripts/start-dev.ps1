param(
    [switch]$InstallFrontendDeps
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot 'backend'
$frontendDir = Join-Path $repoRoot 'frontend'
$backendVenvPython = Join-Path $backendDir '.venv311\Scripts\python.exe'
$backendPidFile = Join-Path $PSScriptRoot '.backend.pid'
$frontendPidFile = Join-Path $PSScriptRoot '.frontend.pid'

function Test-PortOpen {
    param([int]$Port)

    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $iar = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        $ok = $iar.AsyncWaitHandle.WaitOne(300)
        if (-not $ok) { return $false }
        $client.EndConnect($iar) | Out-Null
        return $true
    }
    catch {
        return $false
    }
    finally {
        $client.Close()
    }
}

if (-not (Test-Path $backendDir)) {
    throw "Backend folder not found: $backendDir"
}

if (-not (Test-Path $frontendDir)) {
    throw "Frontend folder not found: $frontendDir"
}

if (-not (Test-Path $backendVenvPython)) {
    Write-Host '[Backend] Creating Python 3.11 virtual environment (.venv311)...' -ForegroundColor Yellow
    Push-Location $backendDir
    try {
        py -3.11 -m venv .venv311
    }
    finally {
        Pop-Location
    }
}

if (-not (Test-PortOpen -Port 8000)) {
    Write-Host '[Backend] Starting API server on 127.0.0.1:8000...' -ForegroundColor Cyan
    $backendProc = Start-Process -FilePath $backendVenvPython -ArgumentList '-m uvicorn server:app --host 127.0.0.1 --port 8000' -WorkingDirectory $backendDir -PassThru
    Set-Content -Path $backendPidFile -Value $backendProc.Id -NoNewline
    Start-Sleep -Seconds 2
}
else {
    Write-Host '[Backend] Port 8000 is already active. Skipping start.' -ForegroundColor Green
}

if ($InstallFrontendDeps -or -not (Test-Path (Join-Path $frontendDir 'node_modules'))) {
    Write-Host '[Frontend] Installing npm dependencies...' -ForegroundColor Yellow
    Push-Location $frontendDir
    try {
        npm install
    }
    finally {
        Pop-Location
    }
}

if (-not (Test-PortOpen -Port 8081)) {
    Write-Host '[Frontend] Starting Expo web on 127.0.0.1:8081...' -ForegroundColor Cyan
    $frontendProc = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run web' -WorkingDirectory $frontendDir -PassThru
    Set-Content -Path $frontendPidFile -Value $frontendProc.Id -NoNewline
    Start-Sleep -Seconds 4
}
else {
    Write-Host '[Frontend] Port 8081 is already active. Skipping start.' -ForegroundColor Green
}

$backendReady = Test-PortOpen -Port 8000
$frontendReady = Test-PortOpen -Port 8081

Write-Host "[Status] Backend (8000): $backendReady" -ForegroundColor White
Write-Host "[Status] Frontend (8081): $frontendReady" -ForegroundColor White

if ($backendReady -and $frontendReady) {
    Write-Host '[Done] SplitBill dev servers are running.' -ForegroundColor Green
    Write-Host 'Frontend: http://127.0.0.1:8081' -ForegroundColor Gray
    Write-Host 'Backend:  http://127.0.0.1:8000' -ForegroundColor Gray
}
else {
    Write-Host '[Warning] One or more services did not start correctly. Check processes/logs.' -ForegroundColor Yellow
}
