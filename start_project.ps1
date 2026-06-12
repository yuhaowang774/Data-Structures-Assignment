param(
    [int]$Port = 5000,
    [switch]$CheckOnly,
    [switch]$NoOpenBrowser,
    [switch]$RebuildCore
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$CoreDir = Join-Path $RepoRoot 'metro_router\core'
$CoreExe = Join-Path $CoreDir 'metro_router.exe'
$AppPath = Join-Path $RepoRoot 'metro_router\app.py'
$GraphFile = Join-Path $RepoRoot 'metro_router\data\graph.txt'
$StationsFile = Join-Path $RepoRoot 'metro_router\data\stations.json'
$Url = "http://127.0.0.1:$Port"
$CoreSourceFiles = @(
    (Join-Path $CoreDir 'main.c'),
    (Join-Path $CoreDir 'dijkstra.c'),
    (Join-Path $CoreDir 'graph.c'),
    (Join-Path $CoreDir 'min_heap.c'),
    (Join-Path $CoreDir 'graph.h'),
    (Join-Path $CoreDir 'dijkstra.h'),
    (Join-Path $CoreDir 'min_heap.h')
)

function Add-PathEntry([string]$PathEntry) {
    if ([string]::IsNullOrWhiteSpace($PathEntry)) {
        return $false
    }

    if (-not (Test-Path $PathEntry)) {
        return $false
    }

    $currentEntries = @($env:PATH -split ';' | Where-Object { $_ })
    foreach ($entry in $currentEntries) {
        if ($entry.TrimEnd('\') -ieq $PathEntry.TrimEnd('\')) {
            return $false
        }
    }

    $env:PATH = "$PathEntry;$env:PATH"
    return $true
}

function Get-MingwBinCandidates() {
    $candidates = New-Object System.Collections.Generic.List[string]

    if ($env:MINGW_HOME) {
        $candidates.Add((Join-Path $env:MINGW_HOME 'bin'))
    }

    if ($env:MSYS2_ROOT) {
        $candidates.Add((Join-Path $env:MSYS2_ROOT 'mingw64\bin'))
        $candidates.Add((Join-Path $env:MSYS2_ROOT 'ucrt64\bin'))
        $candidates.Add((Join-Path $env:MSYS2_ROOT 'clang64\bin'))
    }

    $commonRoots = @(
        'C:\msys64',
        'D:\msys64',
        'C:\mingw64',
        'D:\mingw64',
        'C:\Program Files\mingw-w64',
        'D:\Program Files\mingw-w64'
    )

    foreach ($root in $commonRoots) {
        $candidates.Add((Join-Path $root 'bin'))
        $candidates.Add((Join-Path $root 'mingw64\bin'))
        $candidates.Add((Join-Path $root 'ucrt64\bin'))
        $candidates.Add((Join-Path $root 'clang64\bin'))
    }

    return @($candidates | Select-Object -Unique)
}

function Use-MingwBin([string]$Candidate) {
    if (-not (Test-Path $Candidate)) {
        return $false
    }

    $hasToolchain = (Test-Path (Join-Path $Candidate 'gcc.exe')) -or
        (Test-Path (Join-Path $Candidate 'clang.exe'))
    $hasRuntime = (Test-Path (Join-Path $Candidate 'libwinpthread-1.dll')) -or
        (Test-Path (Join-Path $Candidate 'libgcc_s_seh-1.dll')) -or
        (Test-Path (Join-Path $Candidate 'libgcc_s_dw2-1.dll'))

    if (-not ($hasToolchain -or $hasRuntime)) {
        return $false
    }

    return (Add-PathEntry $Candidate)
}

function Ensure-MingwToolchainAvailable() {
    if (Test-Command 'gcc') {
        return $null
    }

    foreach ($candidate in Get-MingwBinCandidates) {
        $originalPath = $env:PATH
        if (-not (Use-MingwBin $candidate)) {
            continue
        }

        if (Test-Command 'gcc') {
            return $candidate
        }

        $env:PATH = $originalPath
    }

    return $null
}

function Test-CoreBuildNeedsRebuild([string]$ExePath, [string[]]$SourceFiles) {
    if (-not (Test-Path $ExePath)) {
        return $true
    }

    $exeWriteTime = (Get-Item $ExePath).LastWriteTimeUtc
    foreach ($source in $SourceFiles) {
        if ((Test-Path $source) -and (Get-Item $source).LastWriteTimeUtc -gt $exeWriteTime) {
            return $true
        }
    }

    return $false
}

function Invoke-CoreBuild([string]$BuildDir) {
    if (-not (Test-Command 'gcc')) {
        throw 'gcc is not available for building metro_router.exe.'
    }

    $buildArgs = @(
        '-Wall',
        '-O2',
        '-std=c99',
        '-static',
        '-static-libgcc',
        '-o',
        'metro_router.exe',
        'main.c',
        'min_heap.c',
        'graph.c',
        'dijkstra.c'
    )

    Push-Location $BuildDir
    try {
        Remove-Item -LiteralPath '.\metro_router.exe' -Force -ErrorAction SilentlyContinue
        & gcc @buildArgs
        if ($LASTEXITCODE -ne 0) {
            throw 'C core build failed.'
        }
    } finally {
        Pop-Location
    }
}

function Test-CoreRuntimeIndicatesMissingDll([hashtable]$RuntimeCheck) {
    if ($RuntimeCheck.Ok) {
        return $false
    }

    $reason = [string]$RuntimeCheck.Reason
    return $reason.Contains('-1073741515') -or
        $reason.Contains('0xC0000135') -or
        $reason.Contains('STATUS_DLL_NOT_FOUND')
}

function Ensure-CoreRuntimeAvailable([string]$ExePath, [string]$GraphPath, [string]$StationsJsonPath, [hashtable]$InitialRuntimeCheck) {
    if (-not (Test-CoreRuntimeIndicatesMissingDll $InitialRuntimeCheck)) {
        return @{
            ActivatedBin = $null
            RuntimeCheck = $InitialRuntimeCheck
        }
    }

    foreach ($candidate in Get-MingwBinCandidates) {
        $originalPath = $env:PATH
        if (-not (Use-MingwBin $candidate)) {
            continue
        }

        $retry = Test-CoreRuntime -ExePath $ExePath -GraphPath $GraphPath -StationsJsonPath $StationsJsonPath
        if ($retry.Ok) {
            return @{
                ActivatedBin = $candidate
                RuntimeCheck = $retry
            }
        }

        $env:PATH = $originalPath
    }

    return @{
        ActivatedBin = $null
        RuntimeCheck = $InitialRuntimeCheck
    }
}

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

function Test-FlaskInstalled() {
    python -c "import flask, importlib.metadata as m; print(m.version('flask'))"
    return $LASTEXITCODE -eq 0
}

function Get-CoreRuntimeProbeStations([string]$StationsJsonPath) {
    $stationsJson = Get-Content $StationsJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $stationNames = @($stationsJson.stations | Select-Object -ExpandProperty name)
    if ($stationNames.Count -lt 2) {
        throw 'stations.json does not contain enough station names for a runtime check.'
    }

    return @{
        Start = [string]$stationNames[0]
        End = [string]$stationNames[1]
    }
}

function Test-CoreRuntime([string]$ExePath, [string]$GraphPath, [string]$StationsJsonPath) {
    if (-not (Test-Path $ExePath)) {
        return @{
            Ok = $false
            Reason = 'metro_router.exe does not exist.'
        }
    }

    if (-not (Test-Path $GraphPath)) {
        return @{
            Ok = $false
            Reason = 'metro_router/data/graph.txt does not exist.'
        }
    }

    if (-not (Test-Path $StationsJsonPath)) {
        return @{
            Ok = $false
            Reason = 'metro_router/data/stations.json does not exist.'
        }
    }

    try {
        $probe = Get-CoreRuntimeProbeStations $StationsJsonPath
    } catch {
        return @{
            Ok = $false
            Reason = "Failed to read stations.json for runtime probe: $($_.Exception.Message)"
        }
    }

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $ExePath
    $psi.Arguments = "`"$GraphPath`" 0"
    $psi.WorkingDirectory = Split-Path -Parent $ExePath
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi

    try {
        if (-not $process.Start()) {
            return @{
                Ok = $false
                Reason = 'Failed to start metro_router.exe.'
            }
        }

        $process.StandardInput.WriteLine($probe.Start)
        $process.StandardInput.WriteLine($probe.End)
        $process.StandardInput.Close()

        if (-not $process.WaitForExit(5000)) {
            try {
                $process.Kill()
            } catch {
            }

            return @{
                Ok = $false
                Reason = 'metro_router.exe did not finish within 5 seconds.'
            }
        }

        $stdout = $process.StandardOutput.ReadToEnd()
        $stderr = $process.StandardError.ReadToEnd()

        if ($process.ExitCode -ne 0) {
            $details = if ([string]::IsNullOrWhiteSpace($stderr)) {
                'No stderr output was captured.'
            } else {
                $stderr.Trim()
            }

            if ($process.ExitCode -eq -1073741515) {
                $details = "$details Windows status 0xC0000135 (STATUS_DLL_NOT_FOUND): a required runtime DLL could not be loaded."
            }

            return @{
                Ok = $false
                Reason = "metro_router.exe exited with code $($process.ExitCode). $details"
            }
        }

        if ([string]::IsNullOrWhiteSpace($stdout)) {
            return @{
                Ok = $false
                Reason = 'metro_router.exe exited successfully but produced no stdout.'
            }
        }

        return @{
            Ok = $true
            Start = $probe.Start
            End = $probe.End
        }
    } catch {
        return @{
            Ok = $false
            Reason = $_.Exception.Message
        }
    } finally {
        $process.Dispose()
    }
}

function Write-CoreRuntimeHelp() {
    Write-Warn 'metro_router.exe exists, but the machine is missing the runtime needed to execute it, or the graph/data files cannot be read.'
    Write-Warn 'The launcher will first try to add an MSYS2/MinGW bin directory to PATH, then rebuild a self-contained metro_router.exe with gcc if available.'
    Write-Warn 'If that still fails, verify that MSYS2/MinGW-w64 is correctly installed and that gcc can be found in one of the standard bin directories.'
}

Write-Step "Workspace: $RepoRoot"

if (-not (Test-Command 'python')) {
    Write-Fail 'python command is not available in this PowerShell session.'
    exit 1
}

python --version
if ($LASTEXITCODE -ne 0) {
    Write-Fail 'python was found, but python --version failed.'
    exit 1
}

if (-not (Test-FlaskInstalled)) {
    Write-Fail 'Flask is not available in the current python environment.'
    Write-Warn 'Install command: python -m pip install flask'
    exit 1
}

Write-Ok 'Flask check passed.'

$needsBuild = $RebuildCore -or (Test-CoreBuildNeedsRebuild -ExePath $CoreExe -SourceFiles $CoreSourceFiles)
if ($needsBuild) {
    $activatedToolchainBin = Ensure-MingwToolchainAvailable
    if ($activatedToolchainBin) {
        Write-Ok "Added MinGW/MSYS2 bin to PATH for gcc: $activatedToolchainBin"
    }

    if (-not (Test-Command 'gcc')) {
        Write-Fail 'gcc is missing, so metro_router.exe cannot be rebuilt on this machine.'
        exit 1
    }

    $buildReason = if ($RebuildCore) {
        'Rebuilding the C core...'
    }
    elseif (-not (Test-Path $CoreExe)) {
        'metro_router.exe is missing. Building the C core...'
    }
    else {
        'C source files are newer than metro_router.exe. Rebuilding the C core...'
    }

    Write-Step $buildReason
    try {
        Invoke-CoreBuild -BuildDir $CoreDir
    } catch {
        Write-Fail $_.Exception.Message
        exit 1
    }
}

if (-not (Test-Path $CoreExe)) {
    Write-Fail 'metro_router.exe does not exist.'
    exit 1
}

Write-Step 'Verifying that metro_router.exe can actually run on this machine...'
$CoreRuntimeCheck = Test-CoreRuntime -ExePath $CoreExe -GraphPath $GraphFile -StationsJsonPath $StationsFile
$runtimeFallback = Ensure-CoreRuntimeAvailable -ExePath $CoreExe -GraphPath $GraphFile -StationsJsonPath $StationsFile -InitialRuntimeCheck $CoreRuntimeCheck
$CoreRuntimeCheck = $runtimeFallback.RuntimeCheck
if ($runtimeFallback.ActivatedBin) {
    Write-Ok "Added MinGW/MSYS2 bin to PATH for metro_router.exe runtime: $($runtimeFallback.ActivatedBin)"
}

if (-not $CoreRuntimeCheck.Ok -and (Test-CoreRuntimeIndicatesMissingDll $CoreRuntimeCheck)) {
    Write-Warn "metro_router.exe runtime check failed: $($CoreRuntimeCheck.Reason)"
    Write-CoreRuntimeHelp

    $activatedToolchainBin = Ensure-MingwToolchainAvailable
    if ($activatedToolchainBin) {
        Write-Ok "Added MinGW/MSYS2 bin to PATH for gcc: $activatedToolchainBin"
    }

    if (-not (Test-Command 'gcc')) {
        Write-Fail 'gcc is missing, so the launcher cannot rebuild metro_router.exe into a self-contained binary.'
        exit 1
    }

    Write-Step 'Rebuilding metro_router.exe as a self-contained C executable...'
    try {
        Invoke-CoreBuild -BuildDir $CoreDir
    } catch {
        Write-Fail $_.Exception.Message
        exit 1
    }

    $CoreRuntimeCheck = Test-CoreRuntime -ExePath $CoreExe -GraphPath $GraphFile -StationsJsonPath $StationsFile
}

if (-not $CoreRuntimeCheck.Ok) {
    Write-Fail "metro_router.exe runtime check failed: $($CoreRuntimeCheck.Reason)"
    Write-CoreRuntimeHelp
    exit 1
}

Write-Ok 'C core check passed.'

if ($CheckOnly) {
    Write-Ok 'Environment check passed.'
    exit 0
}

if (-not $NoOpenBrowser) {
    Start-Job -ArgumentList $Url -ScriptBlock {
        param($InnerUrl)
        $deadline = (Get-Date).AddSeconds(20)
        while ((Get-Date) -lt $deadline) {
            try {
                Invoke-WebRequest -Uri ($InnerUrl + '/api/stations') -UseBasicParsing -TimeoutSec 2 | Out-Null
                Start-Process $InnerUrl | Out-Null
                return
            } catch {
                Start-Sleep -Milliseconds 700
            }
        }
    } | Out-Null
}

Write-Host ''
Write-Ok "Starting Flask server: $Url"
Write-Warn 'Keep this window open. Press Ctrl+C to stop the server.'
Write-Host ''

Push-Location $RepoRoot
try {
    python $AppPath --port $Port --no-debug
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
