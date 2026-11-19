$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '../ia')
& ./.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8010

