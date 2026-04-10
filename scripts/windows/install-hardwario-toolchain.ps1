$ErrorActionPreference = "Stop"

winget install -e --id Kitware.CMake --silent --accept-package-agreements --accept-source-agreements
winget install -e --id Ninja-build.Ninja --silent --accept-package-agreements --accept-source-agreements
winget install -e --id Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements

$armInstaller = Join-Path $env:TEMP "arm-gnu-toolchain-15.2.rel1-mingw-w64-i686-arm-none-eabi.msi"
Invoke-WebRequest -Uri "https://developer.arm.com/-/media/Files/downloads/gnu/15.2.rel1/binrel/arm-gnu-toolchain-15.2.rel1-mingw-w64-i686-arm-none-eabi.msi" -OutFile $armInstaller
Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$armInstaller`" EULA=1 /quiet" -Wait

$pythonPath = (Get-Command python -ErrorAction SilentlyContinue).Source

if (-not $pythonPath) {
    $pythonPath = (
        Get-ChildItem "$env:LOCALAPPDATA\Programs\Python", "$env:ProgramFiles" -Filter python.exe -Recurse -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending |
        Select-Object -First 1
    ).FullName
}

if (-not $pythonPath) {
    throw "Python installation was not found after install."
}

& $pythonPath -m pip install --upgrade --no-cache-dir bcf

Write-Host ""
Write-Host "Install complete. Restart PowerShell, then verify with:"
Write-Host "  cmake --version"
Write-Host "  ninja --version"
Write-Host "  python --version"
Write-Host "  arm-none-eabi-gcc --version"
Write-Host "  bcf --version"
