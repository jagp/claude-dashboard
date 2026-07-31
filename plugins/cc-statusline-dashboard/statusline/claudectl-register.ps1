# Installs the claudectl:// protocol (idempotent; user-level, no admin).
# 1. Caches the currently-live statusline (once) so uninstall can restore it
# 2. Copies claudectl-handler.ps1 + claudectl.vbs + claudectl-unregister.ps1
#    next to ~/.claude/statusline.js
# 3. Registers HKCU:\Software\Classes\claudectl → wscript claudectl.vbs "%1"
# 4. Registers a Windows Apps & Features entry, so the OS-standard uninstall
#    flow (Settings > Apps > "Claude Control Protocol" > Uninstall) triggers
#    claudectl-unregister.ps1
# Uninstall: run claudectl-unregister.ps1, or use Settings > Apps.

$src = $PSScriptRoot
$dest = Join-Path $env:USERPROFILE '.claude'
# Without this, Copy-Item to a missing folder silently creates a FILE named
# ".claude" and the registration points at a nonexistent script.
New-Item -ItemType Directory -Force -Path $dest | Out-Null

# Cache whatever statusline is live BEFORE claudectl links land. Written only
# once — re-running the installer never overwrites an existing cache, so the
# restore point stays the genuine pre-claudectl statusline.
$statusline = Join-Path $dest 'statusline.js'
$backup = Join-Path $dest 'statusline.js.pre-claudectl.bak'
if ((Test-Path $statusline) -and -not (Test-Path $backup)) {
  Copy-Item $statusline $backup
}

Copy-Item (Join-Path $src 'claudectl-handler.ps1'), (Join-Path $src 'claudectl.vbs'), (Join-Path $src 'claudectl-unregister.ps1') -Destination $dest -Force
$vbs = Join-Path $dest 'claudectl.vbs'

$key = 'HKCU:\Software\Classes\claudectl'
New-Item -Path "$key\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path $key -Name '(default)' -Value 'URL:Claude Control (claudectl)'
New-ItemProperty -Path $key -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null
Set-ItemProperty -Path "$key\shell\open\command" -Name '(default)' -Value ('"{0}" "{1}" "%1"' -f (Join-Path $env:SystemRoot 'System32\wscript.exe'), $vbs)

# Apps & Features entry — the OS-standard deregistration hook. HKCU uninstall
# entries need no admin and appear in Settings > Apps > Installed apps.
$un = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\claudectl'
New-Item -Path $un -Force | Out-Null
Set-ItemProperty -Path $un -Name 'DisplayName' -Value 'Claude Control Protocol (claudectl)'
Set-ItemProperty -Path $un -Name 'Publisher' -Value 'claude-dashboard (local)'
Set-ItemProperty -Path $un -Name 'DisplayVersion' -Value '1.0'
Set-ItemProperty -Path $un -Name 'InstallLocation' -Value $dest
Set-ItemProperty -Path $un -Name 'UninstallString' -Value ('"{0}" -NoProfile -ExecutionPolicy Bypass -File "{1}"' -f (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'), (Join-Path $dest 'claudectl-unregister.ps1'))
New-ItemProperty -Path $un -Name 'NoModify' -Value 1 -PropertyType DWord -Force | Out-Null
New-ItemProperty -Path $un -Name 'NoRepair' -Value 1 -PropertyType DWord -Force | Out-Null

Write-Output "claudectl:// registered:"
Write-Output ("  handler   : {0}" -f (Join-Path $dest 'claudectl-handler.ps1'))
Write-Output ("  command   : {0}" -f (Get-ItemProperty "$key\shell\open\command").'(default)')
Write-Output ("  uninstall : Settings > Apps > 'Claude Control Protocol (claudectl)', or {0}" -f (Join-Path $dest 'claudectl-unregister.ps1'))
if (Test-Path $backup) { Write-Output ("  statusline cache: {0}" -f $backup) }
