param([Parameter(Mandatory=$true)][ValidateSet('backend','frontend','expo','ia','ollama')][string]$Service)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$logs = Join-Path $root '.local/dev'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$log = Join-Path $logs "$Service.log"
Set-Location -LiteralPath $root
"Starting $Service at $(Get-Date -Format o)" | Add-Content -LiteralPath $log
switch ($Service) {
  'backend' { Set-Location (Join-Path $root 'backend'); & npm.cmd run start:dev *>> $log }
  'frontend' { Set-Location (Join-Path $root 'frontend'); & npm.cmd run dev -- --port 5173 --strictPort *>> $log }
  'expo' { Set-Location (Join-Path $root 'mobile'); $env:EXPO_NO_TELEMETRY='1'; & npm.cmd run start -- --lan --port 8081 --go *>> $log }
  'ia' {
    # Existing lightweight service is still required by the project's health endpoint.
    $env:OLLAMA_MODEL='LiquidAI/lfm2.5-1.2b-instruct:q4_k_m'; $env:OLLAMA_URL='http://127.0.0.1:11434'
    & (Join-Path $root 'scripts/start-ia.ps1') *>> $log
  }
  'ollama' { $env:OLLAMA_NUM_PARALLEL='1'; $env:OLLAMA_MAX_LOADED_MODELS='1'; & ollama serve *>> $log }
}
