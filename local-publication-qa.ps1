$ErrorActionPreference = 'Stop'
Set-Location 'F:\bc-book-import-export-20261106'
$line = Get-Content '.env.local' | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (-not $line) { throw 'Missing local database config' }
$env:DATABASE_URL = $line.Substring(13)
if (([uri]$env:DATABASE_URL).Host -ne '127.0.0.1') { throw 'Refusing non-local database' }
npx prisma db push --skip-generate
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run typecheck
exit $LASTEXITCODE
