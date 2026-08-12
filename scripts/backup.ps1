$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path "backups" | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$file = "backups/twisted-vault-$timestamp.sql"
$user = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "vault" }
$db = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "twisted_vault" }
docker compose exec -T db pg_dump --clean --if-exists -U $user $db | Set-Content -Encoding UTF8 $file
Write-Output $file
