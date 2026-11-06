$ErrorActionPreference='Stop'
$original='F:\bc-book-studio'
$candidate='F:\bc-book-dashboard-integration'
$health=Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3182/api/health -TimeoutSec 10
if($health.StatusCode -ne 200){throw 'Candidate unhealthy'}
$candidatePage=Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3182 -TimeoutSec 10
if($candidatePage.Content -notmatch 'PUSAT KENDALI PENERBITAN'){throw 'Candidate dashboard absent'}
$listener=Get-NetTCPConnection -LocalPort 3181 -State Listen
$process=Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
if($process.CommandLine -notmatch 'next.+start.+3181'){throw 'Unexpected preview process; refusing stop'}
$startup=Join-Path $original 'start-local-stack.ps1'
$backup=Join-Path $original 'backups\start-local-stack-before-dashboard.ps1'
Copy-Item $startup $backup -Force
try {
 Stop-Process -Id $listener.OwningProcess
 Start-Process node.exe -ArgumentList 'node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3181' -WorkingDirectory $candidate -RedirectStandardOutput "$candidate\deployed-stdout.log" -RedirectStandardError "$candidate\deployed-stderr.log"
 Start-Sleep -Seconds 3
 $result=Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3181 -TimeoutSec 15
 if($result.StatusCode -ne 200 -or $result.Content -notmatch 'PUSAT KENDALI PENERBITAN'){throw 'Deployment verification failed'}
 $content=[IO.File]::ReadAllText($startup)
 $old="-WorkingDirectory "+'$root'+" -WindowStyle Hidden -RedirectStandardOutput (Join-Path "+'$root'+" 'next-stdout.log')"
 $new="-WorkingDirectory '$candidate' -WindowStyle Hidden -RedirectStandardOutput (Join-Path "+'$root'+" 'next-stdout.log')"
 if(-not $content.Contains($old)){throw 'Startup script differs; rollback required'}
 [IO.File]::WriteAllText($startup,$content.Replace($old,$new))
 Write-Output 'PREVIEW_DASHBOARD_DEPLOYED_3181_HTTP_200_STARTUP_UPDATED'
} catch {
 Get-NetTCPConnection -LocalPort 3181 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {Stop-Process -Id $_.OwningProcess}
 Copy-Item $backup $startup -Force
 Start-Process node.exe -ArgumentList 'node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3181' -WorkingDirectory $original -RedirectStandardOutput "$original\next-stdout.log" -RedirectStandardError "$original\next-stderr.log"
 throw
}
