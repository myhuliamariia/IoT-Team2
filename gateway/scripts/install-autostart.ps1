param(
  [string]$TaskName = "TerrariumGateway",
  [string]$GatewayDir = (Split-Path -Parent $PSScriptRoot),
  [switch]$AtStartup
)

$resolvedGatewayDir = (Resolve-Path -LiteralPath $GatewayDir).ProviderPath
$runnerScriptPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "run-gateway.ps1")).ProviderPath
$powershellPath = (Get-Command powershell.exe -ErrorAction Stop).Source

$actionArguments = @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-WindowStyle", "Hidden",
  "-File", "`"$runnerScriptPath`"",
  "-GatewayDir", "`"$resolvedGatewayDir`""
) -join " "

$action = New-ScheduledTaskAction `
  -Execute $powershellPath `
  -Argument $actionArguments `
  -WorkingDirectory $resolvedGatewayDir

$trigger = if ($AtStartup) {
  New-ScheduledTaskTrigger -AtStartup
} else {
  New-ScheduledTaskTrigger -AtLogOn
}

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Starts the Terrarium Gateway Node-RED runtime automatically." `
  -Force | Out-Null

Write-Output "Scheduled task '$TaskName' registered for '$resolvedGatewayDir'."
