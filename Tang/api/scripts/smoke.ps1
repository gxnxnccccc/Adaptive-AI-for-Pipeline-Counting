# Smoke test for POST /api/counts against the REAL server + Supabase (T4 + T5).
# Run from anywhere:  powershell -File Tang\api\scripts\smoke.ps1
# The server must already be running with a real api\.env (uvicorn app.main:app --port 8000).
# This script reads no secrets. It only talks to the API.
param(
    [string]$Base  = "http://localhost:8000",
    [string]$Dir   = (Join-Path $PSScriptRoot "..\..\samples"),   # Tang\samples
    [int]$Count    = 5
)

$ErrorActionPreference = "Stop"
$script:fails = 0

function Check($ok, $name) {
    if ($ok) { Write-Host "[PASS] $name" -ForegroundColor Green }
    else     { Write-Host "[FAIL] $name" -ForegroundColor Red; $script:fails++ }
}

# POST files, return @{ Status = <http code>; Body = <text> }
function Post-Images($paths) {
    $out = [System.IO.Path]::GetTempFileName()
    $curlArgs = @("-s", "-o", $out, "-w", "%{http_code}")
    foreach ($p in $paths) { $curlArgs += @("-F", "images=@$p") }
    $curlArgs += "$Base/api/counts"
    $code = & curl.exe @curlArgs
    $body = Get-Content -Raw -Encoding UTF8 $out
    Remove-Item $out -ErrorAction SilentlyContinue
    return @{ Status = [int]$code; Body = $body }
}

# 1. health
Write-Host "== 1. GET /health"
$health = & curl.exe -s "$Base/health"
Check ($health -match '"status"\s*:\s*"ok"') "health returns ok"
if ($script:fails -gt 0) { Write-Host "Server not reachable at $Base. Start it first."; exit 1 }

# 2. pick files
Write-Host "== 2. Pick $Count images from $Dir"
if (-not (Test-Path $Dir)) { Write-Host "Folder not found: $Dir"; exit 1 }
$files = @(Get-ChildItem $Dir -File |
    Where-Object { $_.Extension -match '^\.(jpg|jpeg|png|webp)$' } |
    Sort-Object Name | Select-Object -First $Count)
if ($files.Count -lt $Count) {
    Write-Host "Need $Count images in $Dir but found only $($files.Count)."
    exit 1
}
$files | ForEach-Object { Write-Host "  $($_.Name)" }

# 3. real upload
Write-Host "== 3. POST /api/counts with $Count images"
$r = Post-Images ($files | ForEach-Object { $_.FullName })
Check ($r.Status -eq 200) "status 200 (got $($r.Status))"
if ($r.Status -ne 200) { Write-Host $r.Body; exit 1 }
$json = $r.Body | ConvertFrom-Json

$contractKeys = @("count","crop_box","image_id","original_bytes","pipes","quality","stored_bytes") | Sort-Object
$results = @($json.images)

Check ([bool]$json.batch_id) "batch_id present"
Check ($results.Count -eq $Count) "$Count results (got $($results.Count))"

$table = @()
$i = 0
foreach ($img in $results) {
    $i++
    $pipesLen = @($img.pipes).Count
    $keys = @($img.PSObject.Properties.Name | Sort-Object)
    Check ($img.count -eq $pipesLen)                       "image $i : count ($($img.count)) == pipes length ($pipesLen)"
    Check ($img.original_bytes -gt 0)                      "image $i : original_bytes > 0"
    Check (($keys -join ",") -eq ($contractKeys -join ",")) "image $i : keys equal contract keys"
    $table += [pscustomobject]@{
        position       = $i
        image_id       = $img.image_id
        count          = $img.count
        pipes          = $pipesLen
        original_bytes = $img.original_bytes
    }
}
$table | Format-Table -AutoSize

# 4. negative: text file renamed .jpg must give 415
Write-Host "== 4. Negative check: text file named .jpg"
$fake = Join-Path ([System.IO.Path]::GetTempPath()) "smoke_fake.jpg"
Set-Content -Path $fake -Value "this is not an image" -Encoding ASCII
$neg = Post-Images @($fake)
Remove-Item $fake -ErrorAction SilentlyContinue
Check ($neg.Status -eq 415) "fake .jpg rejected with 415 (got $($neg.Status))"

# 5. summary + manual steps
Write-Host ""
if ($script:fails -eq 0) { Write-Host "ALL CHECKS PASSED" -ForegroundColor Green }
else { Write-Host "$($script:fails) CHECK(S) FAILED" -ForegroundColor Red }
Write-Host "batch_id: $($json.batch_id)"
Write-Host ""
Write-Host "Manual steps (Supabase side):"
Write-Host "  1. Open Supabase -> SQL editor, paste Tang\api\scripts\smoke_check.sql,"
Write-Host "     replace BATCH_ID_HERE with: $($json.batch_id)"
Write-Host "  2. Expect: confirmed = false, 5 images, every row ok = true."
Write-Host "  3. Check the file folder exists: api\data\images\$($json.batch_id)"
Write-Host "  4. Clean up: run the delete statement at the bottom of smoke_check.sql"
Write-Host "     (images cascade), then delete the folder:"
Write-Host "     Remove-Item -Recurse api\data\images\$($json.batch_id)"
if ($script:fails -gt 0) { exit 1 }
