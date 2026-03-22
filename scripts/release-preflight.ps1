param(
    [switch]$SkipLint,
    [switch]$SkipRuntimeChecks
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $repoRoot 'frontend'

if (-not (Test-Path $frontendDir)) {
    throw "Frontend folder not found: $frontendDir"
}

function Invoke-Step {
    param(
        [string]$Title,
        [scriptblock]$Action
    )

    Write-Host "`n=== $Title ===" -ForegroundColor Cyan
    & $Action
}

function Test-HttpOk {
    param(
        [string]$Url,
        [int]$TimeoutSec = 8
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec $TimeoutSec -UseBasicParsing
        return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400)
    }
    catch {
        return $false
    }
}

Push-Location $frontendDir
try {
    Invoke-Step -Title 'Validate release environment variables' -Action {
        npm run validate:release-env
        if ($LASTEXITCODE -ne 0) {
            throw 'Release env validation failed.'
        }
    }

    if (-not $SkipLint) {
        Invoke-Step -Title 'Run frontend lint' -Action {
            npm run lint
            if ($LASTEXITCODE -ne 0) {
                throw 'Lint failed.'
            }
        }
    }

    if (-not $SkipRuntimeChecks) {
        Invoke-Step -Title 'Check local backend health endpoint (optional guard)' -Action {
            $healthOk = Test-HttpOk -Url 'http://127.0.0.1:8000/api/health'
            if (-not $healthOk) {
                throw 'Local backend health check failed at http://127.0.0.1:8000/api/health'
            }
            Write-Host 'Backend health endpoint is reachable.' -ForegroundColor Green
        }
    }
}
finally {
    Pop-Location
}

Write-Host "`nRelease preflight passed." -ForegroundColor Green
