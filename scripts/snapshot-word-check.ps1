$ErrorActionPreference='Stop'
Set-Location 'F:\bc-book-studio-terbaru\bc-book-studio'
$word=$null
$doc=$null
try {
 $word=New-Object -ComObject Word.Application
 $word.Visible=$false
 $word.DisplayAlerts=0
 $word.AutomationSecurity=3
 $file=(Resolve-Path 'artifacts/20261110-snapshot/DUMMY-complete.docx').Path
 $doc=$word.Documents.Open($file,$false,$true,$false)
 $result=@{status='PASS';application=$word.Version;paragraphs=$doc.Paragraphs.Count;tables=$doc.Tables.Count;images=$doc.InlineShapes.Count;pages=$doc.ComputeStatistics(2);readOnly=$doc.ReadOnly}
 $result | ConvertTo-Json | Set-Content -Encoding utf8 artifacts/20261110-snapshot/word-open.json
 Write-Output ($result|ConvertTo-Json -Compress)
} catch {
 @{status='BLOCKED';reason=$_.Exception.Message}|ConvertTo-Json|Set-Content -Encoding utf8 artifacts/20261110-snapshot/word-open.json
 Write-Output 'WORD_OPEN_BLOCKED'
} finally {
 if($doc){$doc.Close(0)}
 if($word){$word.Quit()}
}
