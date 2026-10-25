// 一键部署：打包 → 复制到 Suwayomi 的 WebUI 目录。
//
//   pnpm deploy:server            打包并部署
//   pnpm deploy:server --no-build 直接部署现有的 dist
//
// 前提：服务端设置 server.webUIFlavor = CUSTOM（否则服务端会在检查更新时用官方 WebUI 覆盖回去）。
// 目标目录取自 .env.local 里的 SUWAYOMI_DATA（服务端数据目录，里面有 server.conf 和 webUI/）。
// 第一次部署时，目录里如果是官方 WebUI，会先整个备份到 webUI-official-<时间>。
//
// 服务端启动时把 webUI/ 复制到临时目录（java.io.tmpdir/Tachidesk/webUI-serve），之后按请求从磁盘读取，
// 所以部署时顺带更新这份副本即可免重启生效。服务端以其他用户或自定义 tmpdir 运行时，
// 用 .env.local 的 SUWAYOMI_WEBUI_SERVE 指定该目录；找不到或不是本前端的副本时仍需重启。
import { execSync } from 'node:child_process'
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
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

// 日用环境只部署正式构建：环境变量或 .env.local 里残留的 SUKIMI_CHANNEL / SUKIMI_TEST_INSTANCE 会打出带开发者工具箱的包
if (!process.argv.includes('--no-build')) {
  execSync('pnpm build', { stdio: 'inherit', env: { ...process.env, SUKIMI_CHANNEL: 'production', SUKIMI_TEST_INSTANCE: '' } })
}
const dist = resolve('dist')
if (!existsSync(join(dist, 'index.html'))) fail('dist 里没有 index.html，先运行 pnpm build')
// --no-build 直接用现成的 dist，也要拦住 Preview 构建（标题带 [Preview]，与 update-preview.sh 的关卡一致）
if (readFileSync(join(dist, 'index.html'), 'utf8').includes('<title>[Preview]')) {
  fail('dist 是 Preview 构建，不能部署到日用环境。去掉 SUKIMI_CHANNEL 后重新运行 pnpm deploy:server')
}

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
let dirty = false
try {
  commit = execSync('git rev-parse --short HEAD').toString().trim()
  dirty = execSync('git status --porcelain').toString().trim() !== ''
} catch {
  /* 不是 git 仓库也没关系 */
}
const mark = JSON.stringify({ deployedAt: new Date().toISOString(), commit, ...(dirty && { dirty }) }, null, 2)
writeFileSync(join(target, MARK), mark)
console.log(`✓ 已部署到 ${target}${commit ? `（${commit}${dirty ? '，含未提交修改' : ''}）` : ''}`)

// 热更新服务端正在托管的副本：先放资源、最后换 index.html，避免中途请求到引用缺失文件的页面；
// 旧的带哈希资源先留着，已打开的页面懒加载旧分块时不会 404，下次重启服务端会重新复制干净的目录。
const serve = env.SUWAYOMI_WEBUI_SERVE || join(tmpdir(), 'Tachidesk', 'webUI-serve')
if (existsSync(join(serve, MARK))) {
  for (const f of readdirSync(dist)) if (f !== 'index.html') cpSync(join(dist, f), join(serve, f), { recursive: true })
  cpSync(join(dist, 'index.html'), join(serve, 'index.html'))
  writeFileSync(join(serve, MARK), mark)
  console.log(`✓ 已同步服务端托管目录 ${serve}`)
} else {
  console.log(`· 没找到本前端的托管副本（${serve}），需要重启服务端才生效`)
}

// 核验服务端现在返回的页面
const url = env.SUWAYOMI_URL || 'http://localhost:4567'
try {
  const html = await (await fetch(new URL('/', url), { cache: 'no-store' })).text()
  if (html === readFileSync(join(dist, 'index.html'), 'utf8')) console.log('✓ 服务端已返回新版本，刷新浏览器即可')
  else console.log('· 服务端返回的仍是旧页面，重启一次服务端后生效')
} catch {
  console.log(`· 连不上 ${url}，服务端下次启动时会使用新版本`)
}
