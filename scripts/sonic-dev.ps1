param([ValidateSet('Start','Status','Stop')][string]$Action='Start')
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$local = Join-Path $root '.local/dev'
New-Item -ItemType Directory -Force -Path $local | Out-Null
function Open-Port([int]$port) {
  $client = [Net.Sockets.TcpClient]::new()
  try { return $client.ConnectAsync('127.0.0.1',$port).Wait(500) -and $client.Connected } catch { return $false } finally { $client.Dispose() }
}
function Get-Lan {
  $config = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address } | Select-Object -First 1
  if (-not $config) { throw 'No se encontró una IP LAN con puerta de enlace. Conecta Wi-Fi o Ethernet.' }
  return $config.IPv4Address.IPAddress | Select-Object -First 1
}
function Start-Local([string]$name,[int]$port) {
  if (Open-Port $port) { Write-Host "$name reutilizado en puerto $port"; return }
  $record = Join-Path $local "$name.json"
  if (Test-Path -LiteralPath $record) {
    $entry = Get-Content -LiteralPath $record -Raw | ConvertFrom-Json
    $pending = Get-CimInstance Win32_Process -Filter "ProcessId=$($entry.pid)"
    if ($pending -and $entry.root -eq $root -and $pending.CommandLine -like '*run-dev-service.ps1*' -and $pending.CommandLine -like "*-Service $name*") {
      Write-Host "$name ya tiene un proceso iniciado; consulta su log si el puerto sigue pendiente."; return
    }
  }
  $runner = Join-Path $PSScriptRoot 'run-dev-service.ps1'
  $shell = (Get-Process -Id $PID).Path
  $child = Start-Process -FilePath $shell -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+$runner+'"'),'-Service',$name) -WorkingDirectory $root -WindowStyle Hidden -PassThru
  @{pid=$child.Id;service=$name;port=$port;root=$root} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $local "$name.json")
  Write-Host "$name iniciado en proceso persistente $($child.Id). Log: .local/dev/$name.log"
}
if ($Action -eq 'Stop') {
  # Stop ONLY processes started by this script, validating ownership before killing their tree.
  foreach ($name in @('expo','frontend','backend','ia')) {
    $file = Join-Path $local "$name.json"
    if (-not (Test-Path -LiteralPath $file)) { continue }
    $entry = Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($entry.pid)"
    if ($process -and $entry.root -eq $root -and $process.CommandLine -like '*run-dev-service.ps1*' -and $process.CommandLine -like "*-Service $name*") {
      & taskkill.exe /PID $entry.pid /T /F | Out-Null
      Write-Host "$name detenido."
    }
  }
  Write-Host 'PostgreSQL y API Ollama se conservan. No se borraron datos ni modelos.'
  exit
}
$lan = Get-Lan
if ($Action -eq 'Start') {
  $mobileEnv = Join-Path $root 'mobile/.env'
  $text = if (Test-Path $mobileEnv) { Get-Content -LiteralPath $mobileEnv -Raw } else { '' }
  $value = "EXPO_PUBLIC_API_URL=http://${lan}:3000/api"
  if ($text -match '(?m)^EXPO_PUBLIC_API_URL=') { $text = [regex]::Replace($text,'(?m)^EXPO_PUBLIC_API_URL=.*$',$value) } else { $text += "`n$value`n" }
  Set-Content -LiteralPath $mobileEnv -Value $text
  if (-not (Open-Port 5433)) {
    & docker compose --env-file (Join-Path $root 'database/.env') -f (Join-Path $root 'database/compose.yaml') up -d --wait postgres
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar el PostgreSQL existente. No se cambiarán datos.' }
  }
  Start-Local 'ollama' 11434
  Start-Local 'ia' 8010
  Start-Local 'backend' 3000
  Start-Local 'frontend' 5173
  Start-Local 'expo' 8081
}
@(@{service='PostgreSQL';port=5433},@{service='Ollama';port=11434},@{service='IA auxiliar';port=8010},@{service='Backend';port=3000},@{service='Web';port=5173},@{service='Expo';port=8081}) | ForEach-Object { [pscustomobject]@{Servicio=$_.service;Puerto=$_.port;Escuchando=(Open-Port $_.port)} } | Format-Table -AutoSize
Write-Host 'Web: http://localhost:5173'
Write-Host 'API: http://localhost:3000/api | Swagger: http://localhost:3000/docs'
Write-Host "Android API: http://${lan}:3000/api"
Write-Host "Expo Go (SDK 58): exp://${lan}:8081"
Write-Host 'Estado: ./scripts/sonic-dev.ps1 Status | Detener solo servidores propios: ./scripts/sonic-dev.ps1 Stop'
