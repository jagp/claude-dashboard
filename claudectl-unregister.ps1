# Fully reverses claudectl-register.ps1 (idempotent; user-level, no admin):
# 1. Restores the statusline cached at install time (statusline.js.pre-claudectl.bak)
# 2. Removes the claudectl:// protocol key
# 3. Removes the Windows Apps & Features uninstall entry
# 4. Deletes the deployed handler files from ~/.claude (including this script's
#    deployed copy — the repo copy is never touched)
# Runs standalone OR via Settings > Apps > "Claude Control Protocol" > Uninstall.

$dest = Join-Path $env:USERPROFILE '.claude'

# Statusline: put back whatever was live before claudectl links landed. If no
# cache exists (installed on a machine with no statusline), leave it alone —
# clicking its claudectl links then shows the OS "no app" dialog, harmlessly.
$statusline = Join-Path $dest 'statusline.js'
$backup = Join-Path $dest 'statusline.js.pre-claudectl.bak'
if (Test-Path $backup) {
  Move-Item -Force $backup $statusline
  Write-Output 'statusline.js restored from pre-claudectl cache'
} else {
  Write-Output 'no statusline cache found; statusline.js left as-is'
}

foreach ($key in @(
  'HKCU:\Software\Classes\claudectl',
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\claudectl'
)) {
  if (Test-Path $key) { Remove-Item -Recurse -Force $key }
}

foreach ($f in @('claudectl-handler.ps1', 'claudectl.vbs')) {
  $p = Join-Path $dest $f
  if (Test-Path $p) { Remove-Item -Force $p }
}

Write-Output 'claudectl:// unregistered'

# Self-delete the DEPLOYED copy last (safe in PS 5.1 — the script is fully
# read before execution). Guarded so running from the repo never deletes
# repo files.
$deployedSelf = Join-Path $dest 'claudectl-unregister.ps1'
if (Test-Path $deployedSelf) { Remove-Item -Force $deployedSelf }
