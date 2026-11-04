$ErrorActionPreference='Stop'
Set-Location F:\bc-book-dashboard-integration
Get-NetTCPConnection -LocalPort 3182 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess }
npm run build
if($LASTEXITCODE -ne 0){throw 'Build failed'}
Start-Process node.exe -ArgumentList 'node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3182' -WorkingDirectory $PWD -RedirectStandardOutput "$PWD\preview-stdout.log" -RedirectStandardError "$PWD\preview-stderr.log"
Start-Sleep -Seconds 2
npx playwright test dashboard-integration.spec.ts --workers=1 --reporter=line
if($LASTEXITCODE -ne 0){throw 'Browser tests failed'}
