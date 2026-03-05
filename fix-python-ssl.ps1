#!/usr/bin/env powershell
# Purpose: Detect and fix Python SSL issues for local development
# Save this as: fix-python-ssl.ps1
# Run: .\fix-python-ssl.ps1

Write-Host "=== Python & SSL Diagnostic Check ===" -ForegroundColor Cyan

function Test-PythonSSL {
    param([string]$PythonExe, [string]$Label)
    
    Write-Host "`n[Testing] $Label" -ForegroundColor Yellow
    Write-Host "Path: $PythonExe"
    
    # Test version
    $version = & $PythonExe --version 2>&1
    Write-Host "Version: $version"
    
    # Test SSL
    $sslTest = & $PythonExe -c "import ssl; print(ssl.OPENSSL_VERSION)" 2>&1
    
    if ($sslTest -match "OpenSSL") {
        Write-Host "SSL Status: ✅ WORKING" -ForegroundColor Green
        Write-Host "OpenSSL: $sslTest"
        return $true
    } else {
        Write-Host "SSL Status: ❌ BROKEN" -ForegroundColor Red
        Write-Host "Error: $sslTest"
        return $false
    }
}

# Test all available Pythons
$pythons = @(
    @{ Exe = "python"; Label = "System Python (python)" },
    @{ Exe = "py -3.9"; Label = "Python 3.9 (py -3.9)" },
    @{ Exe = "py -3.11"; Label = "Python 3.11 (py -3.11)" },
    @{ Exe = "py -3.12"; Label = "Python 3.12 (py -3.12)" },
    @{ Exe = "C:\Users\kenji\anaconda3\python.exe"; Label = "Anaconda Python 3.9" }
)

$workingPython = $null

foreach ($py in $pythons) {
    $exists = & { cmd /c "where $($py.Exe) >nul 2>&1"; $? }
    if ($exists -or (Test-Path $py.Exe)) {
        if (Test-PythonSSL $py.Exe $py.Label) {
            $workingPython = $py.Exe
        }
    }
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
if ($workingPython) {
    Write-Host "✅ Found working Python: $workingPython" -ForegroundColor Green
    Write-Host "`nNext steps:"
    Write-Host "1. Edit .vscode/tasks.json"
    Write-Host "2. Replace Python path with: $workingPython"
    Write-Host "3. Run Task: Backend: Install Dependencies"
} else {
    Write-Host "❌ No working Python found!" -ForegroundColor Red
    Write-Host "`nRECOMMENDED FIX:"
    Write-Host "1. Download Python 3.12 from python.org"
    Write-Host "2. During install: CHECK 'Install certificates'"
    Write-Host "3. Remove old Python installations"
    Write-Host "4. Run this script again"
}

Write-Host "`n=== Pip Test (will fail if SSL broken) ===" -ForegroundColor Cyan
if ($workingPython) {
    Write-Host "Testing pip with working Python..."
    & $workingPython -m pip --version
}
