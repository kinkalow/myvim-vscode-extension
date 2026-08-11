Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true

$vsix = '.\myvim-0.0.1.vsix'

vsce.cmd package --allow-missing-repository
if ($LASTEXITCODE -ne 0) {
  throw "vsce package failed."
}
code --install-extension $vsix