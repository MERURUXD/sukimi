# Windows 本地 Suwayomi 重启。先用 -WhatIf 预检；不会读取或输出登录凭据。
[CmdletBinding(SupportsShouldProcess, ConfirmImpact = 'Low')]
param(
    [string]$DataDir,
    [string]$ServerUrl,
    [ValidateRange(5, 120)][int]$TimeoutSeconds = 45
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Read-LocalSetting([string]$Name) {
    $envFile = Join-Path $PSScriptRoot '../.env.local'
    if (-not (Test-Path -LiteralPath $envFile)) { return $null }
    $line = Get-Content -LiteralPath $envFile | Where-Object { $_ -match "^\s*$Name\s*=" } | Select-Object -Last 1
    if ($null -eq $line) { return $null }
    return ($line -replace "^\s*$Name\s*=\s*", '').Trim().Trim('"').Trim("'")
}

function Get-ListenerIds([int]$Port) {
    return @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique)
}

function Get-ArgumentPath([string]$Arguments, [string]$Pattern) {
    $match = [regex]::Match($Arguments, $Pattern)
    if (-not $match.Success) { throw '无法确认启动参数中的服务端 JAR 或数据目录，停止操作。' }
    $value = if ($match.Groups[1].Success) { $match.Groups[1].Value } else { $match.Groups[2].Value }
    return [IO.Path]::GetFullPath($value)
}

if (-not $IsWindows) { throw '此脚本仅支持 Windows 本地 Java 安装。' }
if (-not $DataDir) { $DataDir = Read-LocalSetting 'SUWAYOMI_DATA' }
if (-not $ServerUrl) { $ServerUrl = Read-LocalSetting 'SUWAYOMI_URL' }
if (-not $DataDir -or -not $ServerUrl) { throw '请设置 .env.local 的 SUWAYOMI_DATA / SUWAYOMI_URL，或传入 -DataDir / -ServerUrl。' }
$DataDir = (Resolve-Path -LiteralPath $DataDir).Path
$uri = [uri]$ServerUrl
if ($uri.Scheme -ne 'http' -or $uri.Host -notin @('localhost', '127.0.0.1', '[::1]') -or
    $uri.UserInfo -or $uri.Query -or $uri.Fragment -or $uri.AbsolutePath -ne '/') {
    throw '只支持没有凭据、查询参数及路径的本地 HTTP 地址。'
}
$configPath = Join-Path $DataDir 'server.conf'
$webDir = Join-Path $DataDir 'webUI'
if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) { throw '数据目录缺少 server.conf。' }
$ids = @(Get-ListenerIds $uri.Port)
if ($ids.Count -ne 1) { throw '端口没有唯一的监听进程；此脚本只重启正在运行的本地服务端。' }
$oldId = $ids[0]
$old = Get-CimInstance Win32_Process -Filter "ProcessId=$oldId"
if (-not $old -or -not $old.ExecutablePath -or -not $old.CommandLine) { throw '无法核验进程身份；可能需要在服务端所属用户下运行。' }
$javaPath = [IO.Path]::GetFullPath($old.ExecutablePath)
if ([IO.Path]::GetFileName($javaPath) -notin @('java.exe', 'javaw.exe')) { throw '监听进程不是 Java，停止操作。' }
$installDir = Split-Path (Split-Path (Split-Path $javaPath))
$expectedJavaDir = Join-Path $installDir 'jre/bin'
if ((Split-Path $javaPath) -ne [IO.Path]::GetFullPath($expectedJavaDir)) { throw 'Java 不属于 Suwayomi 自带的 jre/bin，停止操作。' }
$commandMatch = [regex]::Match($old.CommandLine, '^\s*(?:"[^"]+"|\S+)\s+(.+)$')
if (-not $commandMatch.Success) { throw '无法保留原始启动参数。' }
$arguments = $commandMatch.Groups[1].Value
$rootArg = Get-ArgumentPath $arguments '(?:^|\s)-Dsuwayomi\.tachidesk\.config\.server\.rootDir=(?:"([^"]+)"|(\S+))(?=\s|$)'
$jarArg = Get-ArgumentPath $arguments '(?:^|\s)-jar\s+(?:"([^"]+)"|(\S+))(?=\s|$)'
$expectedJar = [IO.Path]::GetFullPath((Join-Path $installDir 'bin/Suwayomi-Server.jar'))
if ($rootArg -ne $DataDir -or $jarArg -ne $expectedJar -or -not (Test-Path -LiteralPath $jarArg -PathType Leaf)) {
    throw '服务端 JAR 或数据目录与当前安装不一致，停止操作。'
}
if (Get-CimInstance Win32_Service -Filter "ProcessId=$oldId" | Select-Object -First 1) {
    throw '当前进程由 Windows 服务管理，请使用该服务的重启方式。'
}
$configHash = (Get-FileHash -LiteralPath $configPath -Algorithm SHA256).Hash
$indexPath = Join-Path $webDir 'index.html'
$expectedHtml = if (Test-Path -LiteralPath $indexPath -PathType Leaf) { [IO.File]::ReadAllText($indexPath).Trim() } else { $null }
Write-Host "预检通过：端口 $($uri.Port)，PID $oldId，安装目录 $installDir，数据目录 $DataDir"
if (-not $PSCmdlet.ShouldProcess("Suwayomi PID $oldId / 端口 $($uri.Port)", '备份配置和前端，停止旧进程并按原参数重新启动')) { return }

# 备份不含运行中的数据库；配置原样复制，不解析、不输出其中的凭据。
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$backupDir = Join-Path $DataDir "restart-backups/$stamp"
New-Item -ItemType Directory -Path $backupDir | Out-Null
Copy-Item -LiteralPath $configPath -Destination (Join-Path $backupDir 'server.conf')
if (Test-Path -LiteralPath $webDir) { Copy-Item -LiteralPath $webDir -Destination (Join-Path $backupDir 'webUI') -Recurse }
if ((Get-FileHash -LiteralPath (Join-Path $backupDir 'server.conf')).Hash -ne $configHash) { throw '配置备份校验失败，尚未停止进程。' }
$recordPath = Join-Path $backupDir 'restart.json'
$record = [ordered]@{ time = (Get-Date).ToString('o'); oldPid = $oldId; newPid = $null; status = '已备份'; htmlMatches = $false }
$record | ConvertTo-Json | Set-Content -LiteralPath $recordPath -Encoding utf8
Write-Host "已备份配置和前端：$backupDir"

# 复制备份期间可能换过进程，停止前再核验一次，避免误停复用的 PID。
$current = Get-CimInstance Win32_Process -Filter "ProcessId=$oldId"
$currentIds = @(Get-ListenerIds $uri.Port)
if (-not $current -or $current.ExecutablePath -ne $old.ExecutablePath -or
    $current.CommandLine -ne $old.CommandLine -or $current.CreationDate -ne $old.CreationDate -or
    $currentIds.Count -ne 1 -or $currentIds[0] -ne $oldId -or
    (Get-FileHash -LiteralPath $configPath).Hash -ne $configHash) {
    throw '备份期间进程或配置发生变化，尚未停止进程。'
}

try {
    Stop-Process -Id $oldId -ErrorAction Stop
    $record.status = '旧进程已停止'
    $record | ConvertTo-Json | Set-Content -LiteralPath $recordPath -Encoding utf8
    $deadline = [DateTime]::UtcNow.AddSeconds(15)
    while ((Get-Process -Id $oldId -ErrorAction SilentlyContinue) -or @(Get-ListenerIds $uri.Port).Count) {
        if ([DateTime]::UtcNow -gt $deadline) { throw '旧进程或端口未释放，未启动第二个实例。' }
        Start-Sleep -Milliseconds 250
    }
    $new = Start-Process -FilePath $javaPath -ArgumentList $arguments -WorkingDirectory $installDir -WindowStyle Hidden -PassThru
    $record.newPid = $new.Id
    $record.status = '新进程已启动，等待服务'
    $record | ConvertTo-Json | Set-Content -LiteralPath $recordPath -Encoding utf8
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    $ready = $false
    while ([DateTime]::UtcNow -lt $deadline) {
        if (-not (Get-Process -Id $new.Id -ErrorAction SilentlyContinue)) { throw '新进程已经退出，请检查服务端日志。' }
        $newIds = @(Get-ListenerIds $uri.Port)
        if ($newIds.Count -gt 0 -and ($newIds.Count -ne 1 -or $newIds[0] -ne $new.Id)) { throw '端口被其他进程占用。' }
        try {
            if ($newIds.Count -eq 1) {
                $response = Invoke-WebRequest -Uri "$($uri.GetLeftPart([UriPartial]::Authority))/demo/updates" -TimeoutSec 3
                if ($response.StatusCode -eq 200) { $ready = $true; break }
            }
        } catch { # 启动阶段连接失败会在期限内重试。
        }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw '服务启动超时；保留新进程，请检查服务端日志。' }
    if ((Get-FileHash -LiteralPath $configPath).Hash -ne $configHash) { throw '服务已启动，但配置文件发生变化，请检查。' }
    $record.htmlMatches = $expectedHtml -and $response.Content.Trim() -eq $expectedHtml
    if ($expectedHtml -and -not $record.htmlMatches) { throw '服务已恢复，但返回的 HTML 与 data/webUI/index.html 不一致。' }
    $record.status = '重启成功'
    Write-Host "重启成功：PID $oldId → $($new.Id)，HTTP 200，配置未变化。前端 HTML 校验：$($record.htmlMatches)"
} catch {
    $record.status = '重启未完成'
    throw
} finally {
    $record | ConvertTo-Json | Set-Content -LiteralPath $recordPath -Encoding utf8
}
