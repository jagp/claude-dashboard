# Installs the claudectl:// protocol (idempotent; user-level, no admin).
# 1. Copies claudectl-handler.ps1 + claudectl.vbs next to ~/.claude/statusline.js
# 2. Registers HKCU:\Software\Classes\claudectl → wscript claudectl.vbs "%1"
# Uninstall: Remove-Item -Recurse 'HKCU:\Software\Classes\claudectl' and delete
# the two files from ~/.claude.

$src = $PSScriptRoot
$dest = Join-Path $env:USERPROFILE '.claude'
# Without this, Copy-Item to a missing folder silently creates a FILE named
# ".claude" and the registration points at a nonexistent script.
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item (Join-Path $src 'claudectl-handler.ps1'), (Join-Path $src 'claudectl.vbs') -Destination $dest -Force
$vbs = Join-Path $dest 'claudectl.vbs'

$key = 'HKCU:\Software\Classes\claudectl'
New-Item -Path "$key\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path $key -Name '(default)' -Value 'URL:Claude Control (claudectl)'
New-ItemProperty -Path $key -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null
Set-ItemProperty -Path "$key\shell\open\command" -Name '(default)' -Value ('"{0}" "{1}" "%1"' -f (Join-Path $env:SystemRoot 'System32\wscript.exe'), $vbs)

Write-Output "claudectl:// registered:"
Write-Output ("  handler : {0}" -f (Join-Path $dest 'claudectl-handler.ps1'))
Write-Output ("  command : {0}" -f (Get-ItemProperty "$key\shell\open\command").'(default)')
