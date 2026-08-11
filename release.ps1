param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidatePattern('^\d+\.\d+\.\d+([\-+][0-9A-Za-z.-]+)?$')]
    [string]$Version
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = (Get-Location).Path
}

$PackageJsonPath = Join-Path $ProjectRoot "package.json"
$PackageLockPath = Join-Path $ProjectRoot "package-lock.json"
$TauriConfigPath = Join-Path $ProjectRoot "src-tauri\tauri.conf.json"
$CargoTomlPath = Join-Path $ProjectRoot "src-tauri\Cargo.toml"
$ReleaseExecutablePath = Join-Path $ProjectRoot "src-tauri\target\release\datagrid.exe"

function Assert-FileExists {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Required file was not found: $Path"
    }
}

function Write-Utf8WithoutBom {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )
    $Utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $Utf8WithoutBom)
}

function Update-TauriVersion {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$NewVersion
    )
    $Content = [System.IO.File]::ReadAllText($Path)
    $Pattern = '(?m)^(\s*"version"\s*:\s*")[^"]+(")'
    if ($Content -notmatch $Pattern) {
        throw "Could not find the version property in $Path"
    }
    $UpdatedContent = [regex]::Replace(
        $Content,
        $Pattern,
        { param($Match) $Match.Groups[1].Value + $NewVersion + $Match.Groups[2].Value },
        1
    )
    Write-Utf8WithoutBom -Path $Path -Content $UpdatedContent
}

function Update-CargoVersion {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$NewVersion
    )
    $Content = [System.IO.File]::ReadAllText($Path)
    $Pattern = '(?ms)(^\[package\]\s*.*?^version\s*=\s*")[^"]+(")'
    if ($Content -notmatch $Pattern) {
        throw "Could not find the [package] version in $Path"
    }
    $UpdatedContent = [regex]::Replace(
        $Content,
        $Pattern,
        { param($Match) $Match.Groups[1].Value + $NewVersion + $Match.Groups[2].Value },
        1
    )
    Write-Utf8WithoutBom -Path $Path -Content $UpdatedContent
}

try {
    Write-Host ""
    Write-Host "Datagrid version and build script" -ForegroundColor Cyan
    Write-Host "Project: $ProjectRoot"
    Write-Host "Version: $Version"
    Write-Host ""

    Assert-FileExists -Path $PackageJsonPath
    Assert-FileExists -Path $TauriConfigPath
    Assert-FileExists -Path $CargoTomlPath

    $RunningBuild = Get-Process -Name "datagrid" -ErrorAction SilentlyContinue |
        Where-Object {
            try {
                $_.Path -eq $ReleaseExecutablePath
            }
            catch {
                $false
            }
        }

    if ($RunningBuild) {
        throw "Close the Datagrid release build before packaging: $ReleaseExecutablePath"
    }

    Push-Location $ProjectRoot
    try {
        Write-Host "1/4 Updating package.json..." -ForegroundColor Yellow
        & npm version $Version --no-git-tag-version
        if ($LASTEXITCODE -ne 0) {
            throw "npm version failed with exit code $LASTEXITCODE"
        }

        if (Test-Path -LiteralPath $PackageLockPath) {
            Write-Host "    package-lock.json updated."
        }
        else {
            Write-Host "    No package-lock.json was found."
        }

        Write-Host "2/4 Updating tauri.conf.json..." -ForegroundColor Yellow
        Update-TauriVersion -Path $TauriConfigPath -NewVersion $Version

        Write-Host "3/4 Updating Cargo.toml..." -ForegroundColor Yellow
        Update-CargoVersion -Path $CargoTomlPath -NewVersion $Version

        Write-Host ""
        Write-Host "Versions updated successfully:" -ForegroundColor Green
        Write-Host "  package.json:          $Version"
        Write-Host "  package-lock.json:     $Version"
        Write-Host "  src-tauri/Cargo.toml:  $Version"
        Write-Host "  src-tauri/tauri.conf:  $Version"
        Write-Host ""

        Write-Host "4/4 Building Datagrid..." -ForegroundColor Yellow
        & npm run tauri build
        if ($LASTEXITCODE -ne 0) {
            throw "The Tauri build failed with exit code $LASTEXITCODE"
        }

        Write-Host ""
        Write-Host "Datagrid $Version was built successfully." -ForegroundColor Green
        $BundlePath = Join-Path $ProjectRoot "src-tauri\target\release\bundle"
        if (Test-Path -LiteralPath $BundlePath) {
            Write-Host "Build output:" -ForegroundColor Cyan
            Write-Host $BundlePath
            $Installers = Get-ChildItem -LiteralPath $BundlePath -Recurse -File -ErrorAction SilentlyContinue |
                Where-Object { $_.Extension -in @(".exe", ".msi") }
            if ($Installers) {
                Write-Host ""
                Write-Host "Installers:" -ForegroundColor Cyan
                foreach ($Installer in $Installers) {
                    Write-Host "  $($Installer.FullName)"
                }
            }
        }
    }
    finally {
        Pop-Location
    }
}
catch {
    Write-Host ""
    Write-Host "Version/build process failed." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
