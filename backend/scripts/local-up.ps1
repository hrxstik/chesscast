$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$backendRoot = Join-Path $repoRoot "backend"

Write-Host "==> ChessCast: starting Docker infra (postgres, redis, elasticsearch)..."
Set-Location $repoRoot
docker compose up -d --wait

Set-Location $backendRoot

if (-not (Test-Path ".\.env")) {
  if (Test-Path ".\.env.example") {
    Copy-Item ".\.env.example" ".\.env"
    Write-Host "Created backend\.env from .env.example"
  }
}

Write-Host "==> Prisma generate..."
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
npx prisma generate 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) { throw "prisma generate failed" }

Write-Host "==> Prisma migrate deploy..."
npx prisma migrate deploy 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) { throw "prisma migrate deploy failed" }
$ErrorActionPreference = $prevEap

Write-Host "==> Infra ready. DATABASE_URL must be:"
Write-Host "    postgresql://chesscast:chesscast@127.0.0.1:5432/chesscast?schema=public"
