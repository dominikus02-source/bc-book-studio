$ErrorActionPreference='Stop'
$root='F:\bc-book-studio'
$pg='C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe'
$data=Join-Path $root 'postgres-data'
& $pg -D $data status *> $null
if($LASTEXITCODE -ne 0) {
  & $pg -D $data -l (Join-Path $root 'postgres-startup.log') -w start
  if($LASTEXITCODE -ne 0){throw 'PostgreSQL start failed'}
}
if(-not(Get-NetTCPConnection -LocalPort 3181 -State Listen -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath 'node.exe' -ArgumentList 'node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3181' -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root 'next-stdout.log') -RedirectStandardError (Join-Path $root 'next-stderr.log')
}
Start-Sleep -Seconds 3
try {$response=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3181/api/health' -TimeoutSec 10; if($response.StatusCode -ne 200){throw 'Health check failed'}} catch {throw 'Next.js health check failed'}
$tunnelExe=Join-Path $root 'tools\cloudflared.exe'
$tokenFile=Join-Path $root 'secrets\cloudflare-tunnel-token.txt'
$running=Get-CimInstance Win32_Process -Filter "name = 'cloudflared.exe'" | Where-Object {$_.CommandLine -like '*token-file*' -and $_.CommandLine -like '*bc-book-studio*'}
if(-not $running) {
  Start-Process -FilePath $tunnelExe -ArgumentList @('tunnel','run','--token-file',$tokenFile) -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root 'cloudflared-stdout.log') -RedirectStandardError (Join-Path $root 'cloudflared-stderr.log')
}
Write-Output 'LOCAL_STACK_START_ATTEMPTED'
