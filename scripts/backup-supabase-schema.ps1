param(
    [string]$PgDumpPath = 'D:\User\PostgreSQL\bin\pg_dump.exe'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $PgDumpPath -PathType Leaf)) {
    throw "Không tìm thấy pg_dump tại $PgDumpPath"
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$backupDirectory = Join-Path $repositoryRoot '.backups'
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
$backupFile = Join-Path $backupDirectory ("supabase_public_schema_{0}.sql" -f (Get-Date -Format 'yyyyMMdd_HHmmss'))

$secureUri = Read-Host 'Dán PostgreSQL connection URI của Supabase' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureUri)
try {
    $connectionString = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    $connectionUri = [Uri]$connectionString
    if ($connectionUri.Scheme -notin @('postgres', 'postgresql')) {
        throw 'Connection URI phải bắt đầu bằng postgres:// hoặc postgresql://'
    }

    $userInfo = $connectionUri.UserInfo.Split(':', 2)
    if ($userInfo.Count -ne 2) {
        throw 'Connection URI thiếu tên người dùng hoặc mật khẩu.'
    }

    $env:PGPASSWORD = [Uri]::UnescapeDataString($userInfo[1])
    $env:PGSSLMODE = 'require'
    $dbUser = [Uri]::UnescapeDataString($userInfo[0])
    $dbName = $connectionUri.AbsolutePath.TrimStart('/')
    if (-not $dbName) { throw 'Connection URI thiếu tên database.' }
    $dbPort = if ($connectionUri.IsDefaultPort) { 5432 } else { $connectionUri.Port }

    & $PgDumpPath --host $connectionUri.Host --port $dbPort --username $dbUser --dbname $dbName `
        --schema public --schema-only --no-owner --no-acl --format plain --file $backupFile

    if ($LASTEXITCODE -ne 0) {
        Remove-Item -LiteralPath $backupFile -ErrorAction SilentlyContinue
        throw "pg_dump thất bại (mã $LASTEXITCODE)."
    }
    if ((Get-Item -LiteralPath $backupFile).Length -eq 0) {
        throw 'File backup rỗng.'
    }
    Write-Host "Đã xuất schema public: $backupFile"
} finally {
    $env:PGPASSWORD = $null
    $env:PGSSLMODE = $null
    if ($ptr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
    $connectionString = $null
}
