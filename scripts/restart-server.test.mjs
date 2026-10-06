import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

test('重启预检识别正确安装，拒绝错误进程、数据目录和 Windows 服务，不停止任何进程', {
  skip: process.platform !== 'win32',
}, () => {
  const dir = mkdtempSync(join(tmpdir(), 'sukimi-restart-test-'))
  const data = join(dir, 'data')
  mkdirSync(join(dir, 'bin'), { recursive: true })
  mkdirSync(join(dir, 'jre', 'bin'), { recursive: true })
  mkdirSync(data)
  writeFileSync(join(dir, 'bin', 'Suwayomi-Server.jar'), '')
  writeFileSync(join(data, 'server.conf'), 'server.webUIFlavor = CUSTOM\n')
  const harness = join(dir, 'check.ps1')
  // 用虚构进程替代系统查询；即使误进入执行分支，也会在停止或启动前抛错。
  writeFileSync(harness, `
param([string]$Scenario, [string]$Script, [string]$Root)
$data = Join-Path $Root 'data'
$global:stopped = $false
function Get-NetTCPConnection {
  param($LocalPort, $State, $ErrorAction)
  if ($Scenario -ne 'missing') { [pscustomobject]@{ OwningProcess = 999999 } }
}
function Get-CimInstance {
  param($ClassName, $Filter)
  if ($ClassName -eq 'Win32_Service') {
    if ($Scenario -eq 'service') { [pscustomobject]@{ Name = '虚构服务' } }
    return
  }
  $java = Join-Path $Root 'jre/bin/javaw.exe'
  $rootArg = if ($Scenario -eq 'root') { Join-Path $Root 'other' } else { $data }
  $jar = if ($Scenario -eq 'jar') { Join-Path $Root 'bin/Other.jar' } else { Join-Path $Root 'bin/Suwayomi-Server.jar' }
  if ($Scenario -eq 'executable') { $java = Join-Path $Root 'other.exe' }
  [pscustomobject]@{
    ProcessId = 999999; ExecutablePath = $java; CreationDate = [datetime]'2026-01-01';
    CommandLine = ('"{0}" --add-exports=java.desktop/sun.awt=ALL-UNNAMED -Dsuwayomi.tachidesk.config.server.rootDir="{1}" -jar "{2}"' -f $java, $rootArg, $jar)
  }
}
function Stop-Process { $global:stopped = $true; throw '测试禁止停止进程' }
function Start-Process { throw '测试禁止启动进程' }
$message = $null
try { & $Script -DataDir $data -ServerUrl 'http://127.0.0.1:4567' -WhatIf *> $null }
catch { $message = $_.Exception.Message }
@{ stopped = $global:stopped; error = $message } | ConvertTo-Json -Compress
`)
  try {
    for (const scenario of ['valid', 'missing', 'executable', 'root', 'jar', 'service']) {
      const run = spawnSync('pwsh', ['-NoProfile', '-File', harness, '-Scenario', scenario,
        '-Script', resolve('scripts/restart-server.ps1'), '-Root', dir], { encoding: 'utf8' })
      assert.equal(run.status, 0, run.stderr)
      const result = JSON.parse(run.stdout.trim().split(/\r?\n/).at(-1))
      assert.equal(result.stopped, false, scenario)
      if (scenario === 'valid') assert.equal(result.error, null)
      else assert.ok(result.error, `${scenario} 应拒绝操作`)
    }
    assert.equal(existsSync(join(data, 'restart-backups')), false, '预检不能创建备份或修改服务端目录')
  } finally {
    // 只删除本测试在系统临时目录下创建的目录。
    assert.ok(dir.startsWith(join(tmpdir(), 'sukimi-restart-test-')))
    rmSync(dir, { recursive: true, force: true })
  }
})
