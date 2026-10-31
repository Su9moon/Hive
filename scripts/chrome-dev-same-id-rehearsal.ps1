# T-000497: offline preparation by default. Never accepts a target user-data-dir.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$ChromeDevBinary,
    [Parameter(Mandatory=$true)][string]$CurrentProfileRoot,
    [switch]$Launch
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function CanonicalExisting([string]$Path) {
    if (-not [IO.Path]::IsPathRooted($Path) -or $Path.StartsWith('\\')) { throw 'Local absolute path required' }
    $item = Get-Item -LiteralPath $Path -Force
    $full = $item.FullName.TrimEnd('\')
    $cursor = $item
    while ($null -ne $cursor) {
        if ($cursor.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Reparse path rejected' }
        $cursor = $cursor.Parent
        if ($null -eq $cursor -and $item -is [IO.FileInfo]) { $cursor = $item.Directory; $item = $cursor }
    }
    if ($full.Contains('"')) { throw 'Quote in path rejected' }
    return $full
}
function Overlaps([string]$A, [string]$B) {
    return $A.Equals($B, [StringComparison]::OrdinalIgnoreCase) -or
        $A.StartsWith($B + '\', [StringComparison]::OrdinalIgnoreCase) -or
        $B.StartsWith($A + '\', [StringComparison]::OrdinalIgnoreCase)
}
if ($env:OS -ne 'Windows_NT') { throw 'Windows only; no operation performed' }
$binary = CanonicalExisting $ChromeDevBinary
$current = CanonicalExisting $CurrentProfileRoot
if (-not (Test-Path -LiteralPath $current -PathType Container)) { throw 'Profile root must be an existing directory (metadata only)' }
if ([IO.Path]::GetFileName($binary) -ne 'chrome.exe' -or $binary -notmatch '\\Chrome Dev\\Application\\chrome.exe$') { throw 'Explicit Chrome Dev executable required' }
$version = [Diagnostics.FileVersionInfo]::GetVersionInfo($binary).ProductVersion
if ($version -notmatch '^159\.') { throw 'This rehearsal is scoped to Dev 159; version mismatch' }
$temp = CanonicalExisting ([IO.Path]::GetTempPath())
if (Overlaps $temp $current) { throw 'Temp and protected profile overlap; refusing' }
$root = Join-Path $temp ('hive-same-id-' + [Guid]::NewGuid().ToString('N'))
if (Test-Path -LiteralPath $root) { throw 'Fresh root required' }
$null = New-Item -ItemType Directory -Path $root
$root = CanonicalExisting $root
$profile = Join-Path $root 'isolated-user-data'
if (Overlaps $profile $current) { throw 'Protected profile overlap' }
# Only the public key is read from the repository manifest; no candidate code copied.
$candidate = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../manifest.json') -Raw | ConvertFrom-Json
$key = $candidate.key
if (-not $key) { throw 'No public key: fail closed' }
$der = [Convert]::FromBase64String($key)
$sha = [Security.Cryptography.SHA256]::Create()
try { $digest = $sha.ComputeHash($der) } finally { $sha.Dispose() }
$id = -join ($digest[0..15] | ForEach-Object { [char](97 + ($_ -shr 4)); [char](97 + ($_ -band 15)) })
if ($id -cne 'kheifdlffdfcgmapmbbahdgkpccckmbn') { throw 'Candidate public key does not match expected ID' }
$utf8 = New-Object Text.UTF8Encoding($false)
foreach ($label in @('A', 'B')) {
    $dir = Join-Path $root $label
    $null = New-Item -ItemType Directory -Path $dir
    $manifest = [ordered]@{ manifest_version=3; name="Isolated same-ID mock $label"; version='0.0.1'; key=$key; permissions=@('storage'); background=@{service_worker='worker.js'} }
    [IO.File]::WriteAllText((Join-Path $dir 'manifest.json'), ($manifest | ConvertTo-Json -Depth 5), $utf8)
    $worker = @"
// No automatic storage writes: inspect BEFORE explicitly writing a test value.
globalThis.rehearsalLabel = '$label';
globalThis.inspectRehearsal = async () => ({label: rehearsalLabel, id: chrome.runtime.id, local: await chrome.storage.local.get('rehearsalMarker'), session: await chrome.storage.session.get('rehearsalMarker')});
globalThis.writeRehearsal = async value => { if (typeof value !== 'string' || !value.startsWith('mock-')) throw Error('Use a synthetic mock- marker only'); await chrome.storage.local.set({rehearsalMarker:value}); await chrome.storage.session.set({rehearsalMarker:value}); return inspectRehearsal(); };
"@
    [IO.File]::WriteAllText((Join-Path $dir 'worker.js'), $worker, $utf8)
}
$null = New-Item -ItemType Directory -Path $profile
$receipt = [ordered]@{task='T-000497'; expectedId=$id; binaryVersion=$version; preparation='PASS'; chromeUat='NOT_RUN'; replacement='UNPROVEN'; readiness='BLOCKED'; files=@()}
foreach ($label in @('A','B')) {
    foreach ($file in @('manifest.json','worker.js')) {
        $receipt.files += @{file="$label/$file"; sha256=(Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path (Join-Path $root $label) $file)).Hash}
    }
}
[IO.File]::WriteAllText((Join-Path $root 'preparation.json'), ($receipt | ConvertTo-Json -Depth 6), $utf8)
Write-Output "PREPARATION=PASS EXPECTED_ID=$id CHROME_UAT=NOT_RUN CUTOVER=BLOCKED"
Write-Output "PRIVATE_REHEARSAL_ROOT=$root (do not publish absolute paths)"
if ($Launch) {
    # Revalidate owned paths immediately before launch. Never reuse a preexisting profile.
    $null = CanonicalExisting $root
    $null = CanonicalExisting $profile
    if (@(Get-ChildItem -LiteralPath $profile -Force).Count -ne 0) { throw 'Profile is no longer empty' }
    $arguments = @("--user-data-dir=`"$profile`"", '--no-first-run', '--no-default-browser-check', '--disable-sync', '--disable-background-networking', '--disable-component-update', 'chrome://extensions/')
    Start-Process -FilePath $binary -ArgumentList $arguments
    Write-Output 'LAUNCH_REQUESTED; identity/path/storage checks remain MANUAL / NOT_RUN; CUTOVER=BLOCKED'
}
# No process stop, cleanup, real-profile switch, registry/Host/Kernel/DB operation.
