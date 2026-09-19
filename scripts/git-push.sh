#!/usr/bin/env bash
# 本机提交并推送到 GitHub（Windows 可用 Git Bash 或 WSL 执行）
# 用法: bash scripts/git-push.sh "提交说明"
set -euo pipefail
cd "$(dirname "$0")/.."

MSG="${1:-update $(date +%Y-%m-%d\ %H:%M)}"

if [ ! -d .git ]; then
  echo "尚未 git init。请先按 README「GitHub 部署」完成首次初始化。"
  exit 1
fi

# 防止误提交密钥
if git ls-files --error-unmatch server/.env >/dev/null 2>&1; then
  echo "错误: server/.env 已被 git 跟踪，请先从索引移除: git rm --cached server/.env"
  exit 1
fi
if git ls-files | grep -q '^server/src/data/'; then
  echo "错误: server/src/data/ 不应入库，请: git rm -r --cached server/src/data"
  exit 1
fi

git add -A
if git diff --cached --quiet; then
  echo "没有需要提交的改动。"
  exit 0
fi

git commit -m "$MSG"
# 若尚未设置 remote，只提交不推送
if git remote get-url origin >/dev/null 2>&1; then
  git push
  echo "已推送到 $(git remote get-url origin)"
  echo "下一步: 登录服务器执行 bash scripts/deploy-server.sh"
else
  echo "已本地提交，尚未配置 origin。"
  echo "  git remote add origin https://github.com/<用户>/<仓库>.git"
  echo "  git push -u origin main"
fi
