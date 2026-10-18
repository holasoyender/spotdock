param(
    [string]$CertificateThumbprint,
    [switch]$SkipBuild,
    [switch]$Unsigned
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$desktop = Join-Path $repo 'desktop'
$tauri = Join-Path $desktop 'src-tauri'
$output = Join-Path $tauri 'target\msix'
$staging = Join-Path $output 'staging'
$exe = Join-Path $tauri 'target\release\spotdock-desktop.exe'

if (-not $SkipBuild) {
    Push-Location $repo
    try {
        & bun run --cwd desktop tauri build --no-bundle --ci
        if ($LASTEXITCODE -ne 0) { throw 'Tauri build failed.' }
    } finally { Pop-Location }
}
if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) { throw "Desktop executable not found: $exe" }

if (-not $Unsigned) {
    if ($CertificateThumbprint -notmatch '^[a-fA-F0-9]{40}$') {
        throw 'Pass the 40-character thumbprint of a code-signing certificate in CurrentUser\My.'
    }
    $certificate = Get-Item -LiteralPath "Cert:\CurrentUser\My\$CertificateThumbprint" -ErrorAction Stop
    if (-not $certificate.HasPrivateKey) { throw 'The signing certificate has no private key.' }
    $publisher = [System.Security.SecurityElement]::Escape($certificate.Subject)
} else {
    $publisher = 'CN=SpotDock Development'
}

$sdkRoot = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'
$sdk = Get-ChildItem -LiteralPath $sdkRoot -Directory |
    Where-Object { $_.Name -match '^10\.0\.\d+\.0$' } |
    Sort-Object { [version]$_.Name } -Descending |
    Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'x64\makeappx.exe') } |
    Select-Object -First 1
if (-not $sdk) { throw 'Windows SDK MakeAppx.exe was not found.' }
$makeappx = Join-Path $sdk.FullName 'x64\makeappx.exe'
$signtool = Join-Path $sdk.FullName 'x64\signtool.exe'

$version = (Get-Content -LiteralPath (Join-Path $tauri 'tauri.conf.json') -Raw | ConvertFrom-Json).version
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw "Invalid MSIX version: $version" }
$msixVersion = "$version.0"
$package = Join-Path $output "SpotDock_${msixVersion}_x64.msix"

$resolvedOutput = [IO.Path]::GetFullPath($output)
$resolvedStaging = [IO.Path]::GetFullPath($staging)
if (-not $resolvedStaging.StartsWith($resolvedOutput + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Staging directory is outside the MSIX build directory.'
}
if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
New-Item -ItemType Directory -Path (Join-Path $staging 'Assets') -Force | Out-Null
Copy-Item -LiteralPath $exe -Destination (Join-Path $staging 'spotdock-desktop.exe') -Force
foreach ($icon in 'StoreLogo.png', 'Square150x150Logo.png', 'Square44x44Logo.png') {
    Copy-Item -LiteralPath (Join-Path $tauri "icons\$icon") -Destination (Join-Path $staging "Assets\$icon") -Force
}
$template = Get-Content -LiteralPath (Join-Path $desktop 'msix\AppxManifest.xml.template') -Raw
$manifest = $template.Replace('{{PUBLISHER}}', $publisher).Replace('{{VERSION}}', $msixVersion)
Set-Content -LiteralPath (Join-Path $staging 'AppxManifest.xml') -Value $manifest -Encoding UTF8

& $makeappx pack /d $staging /p $package /o
if ($LASTEXITCODE -ne 0) { throw 'MakeAppx failed.' }
if (-not $Unsigned) {
    if (-not (Test-Path -LiteralPath $signtool -PathType Leaf)) { throw 'Windows SDK SignTool.exe was not found.' }
    & $signtool sign /fd SHA256 /sha1 $CertificateThumbprint /s My $package
    if ($LASTEXITCODE -ne 0) { throw 'MSIX signing failed.' }
}
Write-Output $package
