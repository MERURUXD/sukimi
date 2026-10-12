#!/usr/bin/env bash
# Preview 前端更新：从 GitHub 预发布 webui-preview 拉最新构建，校验哈希后切换到新版本目录。
# 只写 PREVIEW_DIR，不碰 Suwayomi 的 webUI/ 和它的托管副本，更新失败也不影响日用版。
#
# 目录结构（反向代理把站点根目录指向 $PREVIEW_DIR/current）：
#   releases/<时间>-<提交>/   每次构建一份完整文件
#   current -> releases/...   相对符号链接，原子切换；容器里挂载后同样有效
#
# 用法：
#   PREVIEW_DIR=/srv/sukimi-preview update-preview.sh              有新构建就切换
#   PREVIEW_DIR=/srv/sukimi-preview update-preview.sh --rollback   切回上一份，之后不再自动装回被撤下的构建
# 可选环境：GITHUB_TOKEN_FILE（只读令牌文件，私有仓库或限流时用）、SUKIMI_REPO、PREVIEW_KEEP（保留份数，默认 5）
set -euo pipefail
umask 022
dir=${PREVIEW_DIR:?需要 PREVIEW_DIR}
repo=${SUKIMI_REPO:-MERURUXD/sukimi}
token_file=${GITHUB_TOKEN_FILE:-}
keep=${PREVIEW_KEEP:-5}

install -d "$dir/releases"
exec 9>"$dir/.update.lock"
flock -n 9 || exit 0

switch_to() {
  # 先建临时链接再改名覆盖：反向代理任何时候都能读到完整的一份
  ln -sfn "releases/$1" "$dir/.current.next"
  mv -Tf "$dir/.current.next" "$dir/current"
  echo "Preview 已切换到 $1"
}

current_name() { basename "$(readlink "$dir/current" 2>/dev/null || true)"; }

if [ "${1:-}" = --rollback ]; then
  # 按实际上线过的顺序回退，而不是按目录时间：撤下过的版本已从 .history 里去掉，不会再被选中
  now=$(current_name)
  touch "$dir/.history"
  grep -vxF "$now" "$dir/.history" > "$dir/.history.next" || true
  prev=""
  while read -r name; do
    [ -d "$dir/releases/$name" ] && prev=$name
  done < "$dir/.history.next"
  test -n "$prev" || { rm -f "$dir/.history.next"; echo '没有更早的版本可切回'; exit 1; }
  switch_to "$prev"
  mv -f "$dir/.history.next" "$dir/.history"
  # 记下被撤下的提交，定时更新不再把它装回来；有更新的构建时照常切换
  echo "${now##*-}" > "$dir/.skip-commit"
  exit 0
fi

# 令牌经 stdin 传给 curl 的配置，不出现在进程参数里
api() {
  if [ -n "$token_file" ]; then
    printf 'header = "Authorization: Bearer %s"\n' "$(tr -d '\r\n' < "$token_file")" |
      curl -fsSL --max-time 120 -K - -H 'X-GitHub-Api-Version: 2022-11-28' "$@"
  else
    curl -fsSL --max-time 120 -H 'X-GitHub-Api-Version: 2022-11-28' "$@"
  fi
}

work=$(mktemp -d "$dir/.work.XXXXXX")
trap 'rm -rf "$work"' EXIT
api -H 'Accept: application/vnd.github+json' "https://api.github.com/repos/$repo/releases/tags/webui-preview" > "$work/release.json"
read -r manifest_url tar_url < <(python3 - "$work/release.json" <<'PY'
import json, sys
assets = {a['name']: a['url'] for a in json.load(open(sys.argv[1]))['assets']}
print(assets['sukimi-webui-preview.json'], assets['sukimi-webui-preview.tar'])
PY
)
api -H 'Accept: application/octet-stream' "$manifest_url" > "$work/manifest.json"
read -r commit sha < <(python3 - "$work/manifest.json" <<'PY'
import json, re, sys
m = json.load(open(sys.argv[1]))
assert m.get('channel') == 'preview', '清单不是 Preview 构建'
assert re.fullmatch(r'[0-9a-f]{7,40}', m['commit']) and re.fullmatch(r'[0-9a-f]{64}', m['sha256'])
print(m['commit'], m['sha256'])
PY
)
case "$(current_name)" in *-"$commit") exit 0 ;; esac
if [ "$(cat "$dir/.skip-commit" 2>/dev/null)" = "$commit" ]; then exit 0; fi

echo "发现 Preview 新构建 $commit"
api -H 'Accept: application/octet-stream' "$tar_url" > "$work/build.tar"
# 哈希不符多半是正好赶上发布中途，等下一轮
if ! printf '%s  %s\n' "$sha" "$work/build.tar" | sha256sum -c --quiet - 2>/dev/null; then
  echo '归档哈希与清单不符，下一轮再试'
  exit 0
fi
python3 - "$work/build.tar" <<'PY'
import sys, tarfile, pathlib
with tarfile.open(sys.argv[1]) as tf:
    for member in tf.getmembers():
        path = pathlib.PurePosixPath(member.name)
        if path.is_absolute() or '..' in path.parts or member.issym() or member.islnk():
            raise SystemExit('构建归档路径校验失败')
PY

name="$(date -u +%Y%m%dT%H%M%SZ)-$commit"
stage="$dir/releases/$name.tmp"
install -d "$stage"
tar -xf "$work/build.tar" -C "$stage" --no-same-owner
test -f "$stage/index.html"
test -d "$stage/assets"
grep -q '<title>\[Preview\]' "$stage/index.html" || { rm -rf "$stage"; echo '首页没有 Preview 标识，拒绝切换'; exit 1; }
# 记下本次构建自带的资源，再带上上一版自带的那份：已打开的页面延迟加载旧分块时仍能取到，
# 又不会把历代资源一层层复制下去
(cd "$stage/assets" && ls -1A) > "$stage/.own-assets"
if [ -f "$dir/current/.own-assets" ]; then
  while read -r f; do
    [ -e "$dir/current/assets/$f" ] && cp -an "$dir/current/assets/$f" "$stage/assets/"
  done < "$dir/current/.own-assets"
fi
chmod -R a+rX "$stage"
mv "$stage" "$dir/releases/$name"
switch_to "$name"
echo "$name" >> "$dir/.history"

# 只保留最近几份（当前版本一定保留），顺带清理中断留下的临时目录
now=$(current_name)
ls -1 "$dir/releases" | grep -v '\.tmp$' | sort -r | tail -n +$((keep + 1)) | while read -r old; do
  [ "$old" = "$now" ] || rm -rf "${dir:?}/releases/$old"
done
find "$dir/releases" -maxdepth 1 -name '*.tmp' -mmin +60 -exec rm -rf {} +
tail -n 50 "$dir/.history" > "$dir/.history.next" && mv -f "$dir/.history.next" "$dir/.history"
