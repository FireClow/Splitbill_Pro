param(
    [switch]$StartIfNeeded = $true,
    [switch]$DeepChecks,
    [string]$ReportPath
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot 'backend'
$frontendDir = Join-Path $repoRoot 'frontend'
$startScript = Join-Path $PSScriptRoot 'start-dev.ps1'

if (-not $ReportPath) {
    $ReportPath = Join-Path $PSScriptRoot 'maintenance-report.json'
}

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

function Get-ListeningInfo {
    param([int]$Port)

    try {
        $entry = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $entry) {
            return $null
        }

        return [ordered]@{
            localAddress = $entry.LocalAddress
            localPort = $entry.LocalPort
            pid = $entry.OwningProcess
        }
    }
    catch {
        return $null
    }
}

function Invoke-HttpProbe {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 8
    )

    $result = [ordered]@{
        ok = $false
        statusCode = $null
        latencyMs = $null
        body = $null
        error = $null
    }

    $handler = $null
    $client = $null
    $request = $null

    $handler = New-Object System.Net.Http.HttpClientHandler
    $client = New-Object System.Net.Http.HttpClient($handler)
    $client.Timeout = [TimeSpan]::FromSeconds($TimeoutSeconds)
    $request = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Get, $Url)
    $sw = [System.Diagnostics.Stopwatch]::StartNew()

    try {
        $response = $client.SendAsync($request).Result
        $sw.Stop()
        $body = ''
        if ($null -ne $response -and $null -ne $response.Content) {
            $body = $response.Content.ReadAsStringAsync().Result
        }

        if ($null -ne $response) {
            $result.statusCode = [int]$response.StatusCode
            $result.ok = $response.IsSuccessStatusCode
        }
        $result.latencyMs = [math]::Round($sw.Elapsed.TotalMilliseconds, 2)
        $result.body = $body
    }
    catch {
        $sw.Stop()
        $result.error = $_.Exception.Message
        $result.latencyMs = [math]::Round($sw.Elapsed.TotalMilliseconds, 2)
    }
    finally {
        if ($null -ne $request) {
            $request.Dispose()
        }
        if ($null -ne $client) {
            $client.Dispose()
        }
        if ($null -ne $handler) {
            $handler.Dispose()
        }
    }

    return $result
}

function Invoke-CommandCapture {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$WorkingDirectory
    )

    Push-Location $WorkingDirectory
    try {
        $output = (& $FilePath @Arguments 2>&1 | Out-String)
        return [ordered]@{
            exitCode = $LASTEXITCODE
            output = $output.Trim()
        }
    }
    finally {
        Pop-Location
    }
}

$report = [ordered]@{
    timestamp = (Get-Date).ToString('o')
    mode = if ($DeepChecks) { 'deep' } else { 'quick' }
    actions = @()
    services = [ordered]@{}
    checks = [ordered]@{}
    issues = @()
    summary = [ordered]@{}
}

if (-not (Test-Path $backendDir)) {
    throw "Backend folder not found: $backendDir"
}
if (-not (Test-Path $frontendDir)) {
    throw "Frontend folder not found: $frontendDir"
}

$backendUp = Test-PortOpen -Port 8000
$frontendUp = Test-PortOpen -Port 8081

if ($StartIfNeeded -and (-not $backendUp -or -not $frontendUp)) {
    if (-not (Test-Path $startScript)) {
        throw "Startup script not found: $startScript"
    }

    & $startScript
    $report.actions += 'Started dev services using scripts/start-dev.ps1'

    $backendUp = Test-PortOpen -Port 8000
    $frontendUp = Test-PortOpen -Port 8081
}

$mongoUp = Test-PortOpen -Port 27017
$redisUp = Test-PortOpen -Port 6379

$report.services.backend = [ordered]@{
    running = $backendUp
    port = 8000
    listen = Get-ListeningInfo -Port 8000
}
$report.services.frontend = [ordered]@{
    running = $frontendUp
    port = 8081
    listen = Get-ListeningInfo -Port 8081
}
$report.services.mongo = [ordered]@{
    running = $mongoUp
    port = 27017
    listen = Get-ListeningInfo -Port 27017
}
$report.services.redis = [ordered]@{
    running = $redisUp
    port = 6379
    listen = Get-ListeningInfo -Port 6379
}

$backendEnv = Join-Path $backendDir '.env'
$backendEnvExample = Join-Path $backendDir '.env.example'
$report.checks.env = [ordered]@{
    backendEnvExists = (Test-Path $backendEnv)
    backendEnvExampleExists = (Test-Path $backendEnvExample)
}

if (-not $report.checks.env.backendEnvExists) {
    $report.issues += 'backend/.env is missing'
}

if ($backendUp) {
    $health = Invoke-HttpProbe -Url 'http://127.0.0.1:8000/api/health' -TimeoutSeconds 8
    $parsed = $null
    if ($health.body) {
        try {
            $parsed = $health.body | ConvertFrom-Json
        }
        catch {
            $parsed = $null
        }
    }

    $report.checks.backendHealth = [ordered]@{
        ok = $health.ok
        statusCode = $health.statusCode
        latencyMs = $health.latencyMs
        parsed = $parsed
        error = $health.error
    }

    if (-not $health.ok) {
        $report.issues += 'Backend health endpoint is not OK'
    }
}
else {
    $report.checks.backendHealth = [ordered]@{
        ok = $false
        statusCode = $null
        latencyMs = $null
        parsed = $null
        error = 'Backend port 8000 is not open'
    }
    $report.issues += 'Backend is not running on port 8000'
}

if ($frontendUp) {
    $frontendUrls = @(
        'http://127.0.0.1:8081/',
        'http://127.0.0.1:8081/home'
    )
    $frontendAttempts = @()
    $frontendProbe = $null

    foreach ($probeUrl in $frontendUrls) {
        $probe = Invoke-HttpProbe -Url $probeUrl -TimeoutSeconds 20
        $frontendAttempts += [ordered]@{
            url = $probeUrl
            ok = $probe.ok
            statusCode = $probe.statusCode
            latencyMs = $probe.latencyMs
            error = $probe.error
        }

        if ($probe.ok) {
            $frontendProbe = $probe
            break
        }
    }

    if ($null -eq $frontendProbe) {
        $frontendProbe = $frontendAttempts[-1]
    }

    $report.checks.frontendHome = [ordered]@{
        ok = $frontendProbe.ok
        statusCode = $frontendProbe.statusCode
        latencyMs = $frontendProbe.latencyMs
        error = $frontendProbe.error
        attempts = $frontendAttempts
    }

    if (-not $frontendProbe.ok) {
        $report.issues += 'Frontend web endpoints are not responding with success status'
    }
}
else {
    $report.checks.frontendHome = [ordered]@{
        ok = $false
        statusCode = $null
        latencyMs = $null
        error = 'Frontend port 8081 is not open'
    }
    $report.issues += 'Frontend is not running on port 8081'
}

if (-not $mongoUp) {
    $report.issues += 'MongoDB is not listening on port 27017'
}

if (-not $redisUp) {
    $report.issues += 'Redis is not listening on port 6379 (optional unless enabled by your setup)'
}

if ($DeepChecks) {
    $deep = [ordered]@{}

    $lint = Invoke-CommandCapture -FilePath 'npm.cmd' -Arguments @('run', 'lint') -WorkingDirectory $frontendDir
    $deep.frontendLint = [ordered]@{
        ok = ($lint.exitCode -eq 0)
        exitCode = $lint.exitCode
        outputTail = ($lint.output -split "`n" | Select-Object -Last 15) -join "`n"
    }
    if ($lint.exitCode -ne 0) {
        $report.issues += 'Frontend lint failed in deep check'
    }

    $py311 = Join-Path $backendDir '.venv311\Scripts\python.exe'
    $pyFallback = Join-Path $backendDir '.venv\Scripts\python.exe'
    $pyExe = if (Test-Path $py311) { $py311 } elseif (Test-Path $pyFallback) { $pyFallback } else { $null }

    if ($pyExe) {
        $pipCheck = Invoke-CommandCapture -FilePath $pyExe -Arguments @('-m', 'pip', 'check') -WorkingDirectory $backendDir
        $deep.backendPipCheck = [ordered]@{
            ok = ($pipCheck.exitCode -eq 0)
            exitCode = $pipCheck.exitCode
            outputTail = ($pipCheck.output -split "`n" | Select-Object -Last 15) -join "`n"
        }
        if ($pipCheck.exitCode -ne 0) {
            $report.issues += 'Backend pip check failed in deep check'
        }
    }
    else {
        $deep.backendPipCheck = [ordered]@{
            ok = $false
            exitCode = -1
            outputTail = 'No backend Python executable found in .venv311 or .venv'
        }
        $report.issues += 'Unable to run backend pip check (python executable not found)'
    }

    $report.checks.deep = $deep
}

$report.summary = [ordered]@{
    overall = if ($report.issues.Count -eq 0) { 'healthy' } else { 'needs-attention' }
    backend = if ($backendUp) { 'running' } else { 'down' }
    frontend = if ($frontendUp) { 'running' } else { 'down' }
    mongo = if ($mongoUp) { 'running' } else { 'down' }
    redis = if ($redisUp) { 'running' } else { 'down' }
    issuesCount = $report.issues.Count
}

$json = $report | ConvertTo-Json -Depth 10
Set-Content -Path $ReportPath -Value $json -Encoding UTF8

Write-Host "[Maintenance] Report written to: $ReportPath" -ForegroundColor Green
Write-Output $json