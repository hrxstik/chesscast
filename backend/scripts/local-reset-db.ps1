$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot
Write-Host "==> Dropping postgres volume and recreating containers..."
docker compose down
docker volume rm chesscast-dev_postgres_dev_data 2>$null
docker compose up -d --wait
Set-Location (Join-Path $repoRoot "backend")
Write-Host "==> Applying migrations on clean database..."
$ErrorActionPreference = "Continue"
npx prisma migrate deploy 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) { throw "prisma migrate deploy failed" }
Write-Host "==> Done. Optional: npm run db:seed"
