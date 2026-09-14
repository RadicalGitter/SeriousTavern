[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(Mandatory = $true)]
    [string] $Manifest,

    [string] $SillyTavernRoot,

    [string] $DataRoot,

    [string] $UserHandle,

    [switch] $CopyFallback
)

$ErrorActionPreference = 'Stop'

function Resolve-FullPath {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Path,

        [Parameter(Mandatory = $true)]
        [string] $Base
    )

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return [System.IO.Path]::GetFullPath($Path)
    }

    return [System.IO.Path]::GetFullPath((Join-Path -Path $Base -ChildPath $Path))
}

function Read-ConfiguredDataRoot {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Root
    )

    if ($env:SILLYTAVERN_DATAROOT) {
        return Resolve-FullPath -Path $env:SILLYTAVERN_DATAROOT -Base $Root
    }

    $configCandidates = @(
        (Join-Path -Path $Root -ChildPath 'config.yaml'),
        (Join-Path -Path $Root -ChildPath 'default/config.yaml')
    )

    foreach ($configPath in $configCandidates) {
        if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
            continue
        }

        $match = Select-String -LiteralPath $configPath -Pattern '^\s*dataRoot\s*:\s*(.+?)\s*$' | Select-Object -First 1
        if ($match) {
            $configured = $match.Matches[0].Groups[1].Value.Trim().Trim('"').Trim("'")
            return Resolve-FullPath -Path $configured -Base $Root
        }
    }

    return Join-Path -Path $Root -ChildPath 'data'
}

$manifestPath = (Resolve-Path -LiteralPath $Manifest).Path
$manifestDirectory = Split-Path -Parent $manifestPath
$manifestData = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json

if (-not $manifestData.links -or $manifestData.links.Count -eq 0) {
    throw 'Manifest must contain at least one link.'
}

if (-not $SillyTavernRoot) {
    $rootCandidates = @(
        (Join-Path -Path (Get-Location) -ChildPath '../sillyTavern'),
        (Join-Path -Path $manifestDirectory -ChildPath '../../sillyTavern')
    )
    $SillyTavernRoot = $rootCandidates |
        Where-Object { Test-Path -LiteralPath (Join-Path -Path $_ -ChildPath 'package.json') -PathType Leaf } |
        Select-Object -First 1
}

if (-not $SillyTavernRoot) {
    throw 'Could not locate SillyTavern. Pass -SillyTavernRoot explicitly.'
}

$sillyTavernPath = (Resolve-Path -LiteralPath $SillyTavernRoot).Path
if (-not (Test-Path -LiteralPath (Join-Path -Path $sillyTavernPath -ChildPath 'package.json') -PathType Leaf)) {
    throw "Not a SillyTavern checkout: $sillyTavernPath"
}

$resolvedDataRoot = if ($DataRoot) {
    Resolve-FullPath -Path $DataRoot -Base $sillyTavernPath
} else {
    Read-ConfiguredDataRoot -Root $sillyTavernPath
}

$selectedUser = if ($UserHandle) {
    $UserHandle
} elseif ($manifestData.userHandle) {
    [string] $manifestData.userHandle
} else {
    'default-user'
}

if ($selectedUser -match '[\\/]' -or $selectedUser -eq '.' -or $selectedUser -eq '..') {
    throw "Invalid SillyTavern user handle: $selectedUser"
}

$userRoot = [System.IO.Path]::GetFullPath((Join-Path -Path $resolvedDataRoot -ChildPath $selectedUser))
$userRootPrefix = $userRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

foreach ($link in $manifestData.links) {
    $sourceRelative = [string] $link.source
    $destinationRelative = [string] $link.destination

    if (-not $sourceRelative -or -not $destinationRelative) {
        throw 'Every manifest link requires source and destination.'
    }
    if ([System.IO.Path]::IsPathRooted($destinationRelative)) {
        throw "Destination must be relative to the selected user root: $destinationRelative"
    }
    if (($destinationRelative -split '[\\/]') -contains '..') {
        throw "Destination may not traverse outside the selected user root: $destinationRelative"
    }

    $sourcePath = Resolve-FullPath -Path $sourceRelative -Base $manifestDirectory
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw "Source file does not exist: $sourcePath"
    }

    $destinationPath = [System.IO.Path]::GetFullPath((Join-Path -Path $userRoot -ChildPath $destinationRelative))
    if (-not $destinationPath.StartsWith($userRootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Destination escaped the selected user root: $destinationPath"
    }

    $destinationParts = $destinationRelative -split '[\\/]'
    $destinationArea = $destinationParts[0]
    $destinationExtension = [System.IO.Path]::GetExtension($destinationPath)
    if ($destinationArea -ieq 'characters' -and $destinationExtension -ine '.png') {
        throw "Direct character storage requires a PNG card, not $destinationExtension`: $destinationRelative"
    }
    if (($destinationArea -ieq 'worlds' -or $destinationArea -match 'Settings$') -and $destinationExtension -ine '.json') {
        throw "Direct World Info and preset storage requires JSON: $destinationRelative"
    }

    $destinationParent = Split-Path -Parent $destinationPath
    if ($PSCmdlet.ShouldProcess($destinationParent, 'Create SillyTavern data directory')) {
        New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null
    }

    if (Test-Path -LiteralPath $destinationPath) {
        $existing = Get-Item -Force -LiteralPath $destinationPath
        if ($existing.LinkType -eq 'SymbolicLink') {
            $existingTarget = Resolve-FullPath -Path ([string] $existing.Target) -Base $destinationParent
            if ($existingTarget -eq $sourcePath) {
                Write-Output "Already linked: $destinationPath"
                continue
            }
        }
        throw "Destination already exists and was not replaced: $destinationPath"
    }

    if (-not $PSCmdlet.ShouldProcess($destinationPath, "Link to $sourcePath")) {
        continue
    }

    try {
        New-Item -ItemType SymbolicLink -Path $destinationPath -Target $sourcePath | Out-Null
        Write-Output "Linked: $destinationPath -> $sourcePath"
    } catch {
        if (-not $CopyFallback) {
            throw
        }
        Copy-Item -LiteralPath $sourcePath -Destination $destinationPath
        Write-Output "Copied snapshot: $destinationPath <- $sourcePath"
    }
}
