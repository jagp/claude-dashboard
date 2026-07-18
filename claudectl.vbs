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
  args = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & handler & """ """ & WScript.Arguments(0) & """"
  CreateObject("Shell.Application").ShellExecute "powershell.exe", args, "", "open", 0
End If
