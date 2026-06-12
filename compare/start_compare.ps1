param(
    [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"

$CompareRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $CompareRoot
$StationsFile = Join-Path $RepoRoot "metro_router\data\stations.json"
$GraphFile = Join-Path $RepoRoot "metro_router\data\graph.txt"
$ConfigFile = Join-Path $CompareRoot "config.py"

function Write-Step([string]$Message) {
    Write-Host "[STEP] $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
    Write-Host "[ OK ] $Message" -ForegroundColor Green
}

function Write-Warn([string]$Message) {
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Fail([string]$Message) {
    Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Test-Command([string]$Name) {
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

Write-Step "Workspace: $RepoRoot"
Write-Step "Compare directory: $CompareRoot"

if (-not (Test-Command "python")) {
    Write-Fail "python command is not available in this PowerShell session."
    exit 1
}

python --version
if ($LASTEXITCODE -ne 0) {
    Write-Fail "python was found, but python --version failed."
    exit 1
}

if (-not (Test-Path $ConfigFile)) {
    Write-Fail "compare/config.py does not exist."
    exit 1
}

if (-not (Test-Path $StationsFile)) {
    Write-Fail "metro_router/data/stations.json does not exist."
    exit 1
}

if (-not (Test-Path $GraphFile)) {
    Write-Fail "metro_router/data/graph.txt does not exist."
    exit 1
}

Write-Ok "Compare configuration and local data files were found."

if (-not $env:AMAP_KEY) {
    Write-Warn "AMAP_KEY is not set in the current environment. The compare tool will use the key in compare/config.py."
}

if ($CheckOnly) {
    Write-Ok "Compare environment check passed."
    exit 0
}

Write-Host ""
Write-Ok "Starting compare task..."
Write-Warn "Keep this window open until the compare run finishes."
Write-Host ""

Push-Location $RepoRoot
try {
    python -m compare.run_compare
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
