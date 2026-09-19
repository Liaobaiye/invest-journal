#!/usr/bin/env bash
# 服务器端：拉取 GitHub 更新并热重载 Node
# 在项目根目录执行: bash scripts/deploy-server.sh
# 可选环境变量: APP_NAME=myweb  RELOAD_CMD="pm2 reload myweb"
set -euo pipefail
cd "$(dirname "$0")/.."

APP_NAME="${APP_NAME:-myweb}"
BRANCH="${BRANCH:-main}"

echo "==> git pull ($BRANCH)"
if [ -d .git ]; then
  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
  # 保留服务器本地密钥与数据（若曾误提交请确保它们在 .gitignore）
  git clean -fd -e server/.env -e server/src/data -e server/data -e node_modules -e server/node_modules
else
  echo "当前目录不是 git 仓库，请先 clone:"
  echo "  git clone https://github.com/<用户>/<仓库>.git"
  exit 1
fi

echo "==> npm install (server)"
cd server
if [ -f package-lock.json ]; then
  npm ci --omit=dev || npm install --omit=dev
else
  npm install --omit=dev
fi
cd ..

echo "==> reload process"
if [ -n "${RELOAD_CMD:-}" ]; then
  eval "$RELOAD_CMD"
elif command -v pm2 >/dev/null 2>&1 && pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 reload "$APP_NAME"
  pm2 save
  echo "pm2 reload $APP_NAME 完成"
else
  echo "未找到 pm2 进程 $APP_NAME，请手动重启，例如:"
  echo "  cd server && npm start"
  echo "  或: pm2 start src/index.js --name $APP_NAME"
fi

echo "==> done"
echo "前端已更新（浏览器 Ctrl+F5）；后端若 reload 则立即生效。"
echo "注意: 修改过 server/.env 必须 restart（pm2 restart $APP_NAME），不能只 reload。"
