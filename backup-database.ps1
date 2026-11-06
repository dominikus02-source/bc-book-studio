$ErrorActionPreference='Stop'
$root='F:\bc-book-studio'
$pg='C:\Program Files\PostgreSQL\18\bin'
$env:PGPASSWORD=[IO.File]::ReadAllText((Join-Path $root 'secrets\bcstudio-pg-app-password.txt')).Trim()
try {
  $dir=Join-Path $root 'backups'
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $file=Join-Path $dir ('bcbookstudio-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.dump')
  & "$pg\pg_dump.exe" -w -h 127.0.0.1 -p 5433 -U bcstudio_app -d bcbookstudio -Fc -f $file
  if($LASTEXITCODE -ne 0){throw 'pg_dump failed'}
  & "$pg\pg_restore.exe" --list $file | Out-Null
  if($LASTEXITCODE -ne 0){throw 'backup archive validation failed'}
  Get-ChildItem $dir -Filter 'bcbookstudio-*.dump' -File | Where-Object {$_.LastWriteTime -lt (Get-Date).AddDays(-14)} | Remove-Item -Force
  Write-Output ('BACKUP_PASS '+(Get-Item $file).Length+' bytes')
} finally {Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue}
