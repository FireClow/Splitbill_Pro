param(
    [string]$Version = "v5.3.3",
    [string]$Build = "20231005"
)

$ErrorActionPreference = "Stop"

$downloadBase = "https://github.com/UB-Mannheim/tesseract/releases/download"
$installerName = "tesseract-ocr-w64-setup-$Version.$Build.exe"
$downloadUrl = "$downloadBase/$Version/$installerName"
$installerPath = Join-Path $PSScriptRoot "tesseract-installer.exe"

Write-Host "[OCR] Downloading Tesseract installer..." -ForegroundColor Cyan
Write-Host "[OCR] URL: $downloadUrl" -ForegroundColor DarkGray
Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath

Write-Host "[OCR] Installer downloaded: $installerPath" -ForegroundColor Green
Write-Host "[OCR] Next steps:" -ForegroundColor Yellow
Write-Host "1. Run installer as Administrator (double-click file above)."
Write-Host "2. Install to: C:\Program Files\Tesseract-OCR"
Write-Host "3. Enable option to add Tesseract to PATH if available."
Write-Host "4. Restart terminal and backend server after installation."
Write-Host ""

$defaultBinary = "C:\Program Files\Tesseract-OCR\tesseract.exe"
if (Test-Path $defaultBinary) {
    Write-Host "[OCR] Existing install detected at default location." -ForegroundColor Green
}

$pathBinary = Get-Command tesseract -ErrorAction SilentlyContinue
if ($pathBinary) {
    Write-Host "[OCR] tesseract already available in PATH:" -ForegroundColor Green
    Write-Host "      $($pathBinary.Source)"
    tesseract --version
} else {
    Write-Host "[OCR] Tesseract not detected in PATH yet." -ForegroundColor Yellow
    Write-Host "[OCR] After installation, verify with: tesseract --version"
}
