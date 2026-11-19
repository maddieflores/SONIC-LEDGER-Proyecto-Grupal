$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot
$password = [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
$jwt = [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
$databaseEnv = Join-Path $root 'database/.env'
if (-not (Test-Path $databaseEnv)) {
  Set-Content -LiteralPath $databaseEnv -Value "POSTGRES_PASSWORD=$password" -Encoding utf8
} else {
  $password = ((Get-Content $databaseEnv | Where-Object { $_ -like 'POSTGRES_PASSWORD=*' }) -split '=',2)[1]
}
$backendEnv = Join-Path $root 'backend/.env'
if (-not (Test-Path $backendEnv)) {
  (Get-Content (Join-Path $root 'backend/.env.example') -Raw).Replace('REEMPLAZAR_POR_UNA_CLAVE_LOCAL',$password).Replace('REEMPLAZAR_POR_UN_SECRETO_ALEATORIO',$jwt) | Set-Content $backendEnv -Encoding utf8
}
foreach ($folder in @('frontend','mobile','ia')) {
  $destination = Join-Path $root "$folder/.env"
  if (-not (Test-Path $destination)) { Copy-Item (Join-Path $root "$folder/.env.example") $destination }
}
Write-Host 'Configuracion local creada sin sobrescribir archivos existentes.'
