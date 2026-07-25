# claudectl:// protocol handler — shows a local path in Windows Explorer.
# Invoked by the OS (via claudectl.vbs, see claudectl-register.ps1) when a
# claudectl:// link is clicked in any terminal, including VS Code's integrated
# terminal (which intercepts file:// links itself but must hand unknown
# schemes to the OS).
#
# URI shape (produced by statusline.current.js):
#   claudectl://open/C:/Users/jared/Some%20Dir        → Explorer window on the folder
#   claudectl://open/C:/Users/jared/Some%20Dir/f.txt  → Explorer with the file selected
#
# Deliberately non-destructive: the only action is showing an existing path in
# Explorer. A registered scheme is invocable by any web page, so nothing here
# may ever delete, write, or execute (see docs/HOTSTART.md security note).
#
# Set CLAUDECTL_DRYRUN=1 to print the resolved action instead of launching.

param([Parameter(Mandatory = $true)][string]$Uri)

# Tolerate 0-3 slashes after the colon (URI normalizers vary) and a
# percent-encoded drive colon (C%3A) — UnescapeDataString restores it.
$m = [regex]::Match($Uri, '^claudectl:/{0,3}(?<action>[A-Za-z]+)/(?<rest>.+)$')
if (-not $m.Success) { exit 1 }
$action = $m.Groups['action'].Value.ToLower()
$path = [uri]::UnescapeDataString($m.Groups['rest'].Value) -replace '/', '\'
$path = $path.TrimEnd('\')
if ($path -match '^[A-Za-z]:$') { $path += '\' }  # bare drive letter → its root

# Local fixed-drive paths ONLY, checked BEFORE any filesystem probe. A UNC
# target (\\host\share, //host/share, \\host@SSL\Dav...) would make Test-Path
# open an outbound SMB/WebDAV connection that auto-sends the user's NTLM
# credentials — a drive-by hash-leak primitive, since any web page can invoke
# a registered scheme. Statusline links are always drive-letter paths.
if ($path -notmatch '^[A-Za-z]:\\') {
  if ($env:CLAUDECTL_DRYRUN) { Write-Output "rejected action=$action path=$path" }
  exit 1
}

$isDir = Test-Path -LiteralPath $path -PathType Container
$isFile = Test-Path -LiteralPath $path -PathType Leaf

if ($env:CLAUDECTL_DRYRUN) {
  Write-Output "action=$action path=$path dir=$isDir file=$isFile"
  exit 0
}

switch ($action) {
  'open' {
    if ($isDir) {
      Start-Process explorer.exe -ArgumentList "`"$path`""
    } elseif ($isFile) {
      Start-Process explorer.exe -ArgumentList "/select,`"$path`""
    }
    # Nonexistent path: do nothing (never surface an error UI from a click).
  }
}
