param(
  [string]$GatewayDir = (Split-Path -Parent $PSScriptRoot)
)

$resolvedGatewayDir = (Resolve-Path -LiteralPath $GatewayDir).ProviderPath
$nodeCommand = Get-Command node.exe -ErrorAction Stop

Set-Location -LiteralPath $resolvedGatewayDir
& $nodeCommand.Source ".\start-node-red.mjs"
exit $LASTEXITCODE
