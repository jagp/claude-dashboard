' Windowless launcher for claudectl-handler.ps1 (same folder as this script).
' Registered as the claudectl:// protocol command so clicks never flash a
' console window (powershell.exe alone would, even with -WindowStyle Hidden).
' Uses Shell.Application.ShellExecute, NOT WScript.Shell.Run: Run expands
' %NAME% environment patterns inside the command string, which corrupts
' percent-encoded URIs (a%20b + an env var named "20b" → aXXXb); ShellExecute
' passes the argument string through verbatim.
If WScript.Arguments.Count > 0 Then
  Set fso = CreateObject("Scripting.FileSystemObject")
  handler = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "claudectl-handler.ps1")
  ' Strip double quotes from the URI: a literal " could break out of the quoted
  ' argument below and smuggle extra powershell.exe arguments. Quotes are never
  ' valid in a claudectl:// URI (the statusline percent-encodes them), so
  ' stripping loses nothing legitimate.
  uri = Replace(WScript.Arguments(0), """", "")
  args = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & handler & """ """ & uri & """"
  CreateObject("Shell.Application").ShellExecute "powershell.exe", args, "", "open", 0
End If
