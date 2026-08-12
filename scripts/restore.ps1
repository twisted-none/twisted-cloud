param([Parameter(Mandatory=$true)][string]$File)
$ErrorActionPreference = "Stop"
$user = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "vault" }
$db = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "twisted_vault" }
Get-Content $File | docker compose exec -T db psql -U $user $db
