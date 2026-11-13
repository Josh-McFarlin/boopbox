# BoopBox: build the firmware, then open the browser installer.
# Uses the dependencies already prepared (a WSL distribution with the JieLi toolchain, SDK files in build/deps/ac79).
# SLOOP_WSL_DISTRO (default Ubuntu) and SLOOP_TOOLCHAIN (a Linux path, default /root/.jieli/toolchain) override them (BUILDING.md).
# SLICE stays out (FELUCCA_SLICE=0): with its built-in BREAK the image does not fit the app slot.
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)   # the project source directory
# The version, from FELUCCA_VERSION in firmware/src/ui.c ("BOOPBOX 1.9.3" gives 1.9.3)
$m = Select-String -Path firmware/src/ui.c -Pattern '#define FELUCCA_VERSION "BOOPBOX ([^"]+)"' | Select-Object -First 1
if (-not $m) { throw "No FELUCCA_VERSION in firmware/src/ui.c" }
$Version = $m.Matches[0].Groups[1].Value
$Distro = if ($env:SLOOP_WSL_DISTRO) { $env:SLOOP_WSL_DISTRO } else { 'Ubuntu' }
$Toolchain = if ($env:SLOOP_TOOLCHAIN) { $env:SLOOP_TOOLCHAIN } else { '/root/.jieli/toolchain' }
Write-Host ""
Write-Host "  B O O P B O X   $Version" -ForegroundColor White
Write-Host "  ---- ---- ---- ----" -ForegroundColor DarkGray
Write-Host "== Building the firmware (WSL $Distro)" -ForegroundColor Cyan
Remove-Item Env:FELUCCA_SLICE -ErrorAction SilentlyContinue
python tools/build_windows.py --distro $Distro --toolchain $Toolchain --sdk build/deps/ac79 --slice 0
if ($LASTEXITCODE -ne 0) { throw "The build failed" }
Write-Host "== Making the installer site" -ForegroundColor Cyan
python ..\..\web\make_site.py build/felucca.fwsc $Version build/boopbox-site
if ($LASTEXITCODE -ne 0) { throw "make_site failed" }
Write-Host ""
Write-Host "Installer: http://localhost:8766/installer/  (Chrome or Edge, FM-1 on USB)" -ForegroundColor Green
Write-Host "Editor:    http://localhost:8766/editor/" -ForegroundColor Green
Write-Host "Keep this window open during the install. Ctrl+C stops the server."
Start-Process "http://localhost:8766/installer/"
python -m http.server 8766 --bind 127.0.0.1 --directory build/boopbox-site
