// 一键部署：打包 → 复制到 Suwayomi 的 WebUI 目录。
//
//   pnpm deploy:server            打包并部署
//   pnpm deploy:server --no-build 直接部署现有的 dist
//
// 前提：服务端设置 server.webUIFlavor = CUSTOM（否则服务端会在检查更新时用官方 WebUI 覆盖回去）。
// 目标目录取自 .env.local 里的 SUWAYOMI_DATA（服务端数据目录，里面有 server.conf 和 webUI/）。
// 第一次部署时，目录里如果是官方 WebUI，会先整个备份到 webUI-official-<时间>。
import { execSync } from 'node:child_process'
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { loadEnv } from 'vite'

const MARK = '.suwayomi-web'
const fail = (msg) => {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

const env = loadEnv('production', process.cwd(), '')
const dataDir = env.SUWAYOMI_DATA
if (!dataDir) fail('请在 .env.local 里设置 SUWAYOMI_DATA，指向自己的 Suwayomi 数据目录')
if (!existsSync(join(dataDir, 'server.conf'))) fail(`${dataDir} 下没有 server.conf，不像是 Suwayomi 的数据目录`)

// 只读这一行，不碰其他设置（server.conf 里还有登录账号）
const flavor = /^\s*server\.webUIFlavor\s*=\s*"?(\w+)"?/im.exec(readFileSync(join(dataDir, 'server.conf'), 'utf8'))?.[1]
if (flavor?.toUpperCase() !== 'CUSTOM') {
  fail(`服务端 webUIFlavor 现在是 ${flavor ?? '未设置'}，不是 CUSTOM：部署后会被官方 WebUI 覆盖。先改设置再部署。`)
}

if (!process.argv.includes('--no-build')) execSync('pnpm build', { stdio: 'inherit' })
const dist = resolve('dist')
if (!existsSync(join(dist, 'index.html'))) fail('dist 里没有 index.html，先运行 pnpm build')

const target = join(dataDir, 'webUI')
if (existsSync(target) && readdirSync(target).length && !existsSync(join(target, MARK))) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const backup = join(dataDir, `webUI-official-${stamp}`)
  cpSync(target, backup, { recursive: true })
  console.log(`已备份原来的 WebUI → ${backup}`)
}

// 清空后整体复制，避免旧版本的文件残留
for (const f of existsSync(target) ? readdirSync(target) : []) rmSync(join(target, f), { recursive: true, force: true })
cpSync(dist, target, { recursive: true })

let commit = ''
try {
  commit = execSync('git rev-parse --short HEAD').toString().trim()
} catch {
  /* 不是 git 仓库也没关系 */
}
writeFileSync(join(target, MARK), JSON.stringify({ deployedAt: new Date().toISOString(), commit }, null, 2))
console.log(`✓ 已部署到 ${target}${commit ? `（${commit}）` : ''}。刷新浏览器即可；如果看到的还是旧界面，重启一次服务端。`)
