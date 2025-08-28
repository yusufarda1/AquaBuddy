#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 3 ]; then
  echo "Kullanım: $0 <github_kullanici_adi> <repo_adi> <github_pat>"
  exit 1
fi

GH_USER="$1"
REPO_NAME="$2"
GH_PAT="$3"

REPO_URL="https://${GH_USER}:${GH_PAT}@github.com/${GH_USER}/${REPO_NAME}.git"

# Git repo yoksa başlat
if [ ! -d .git ]; then
  git init
  git config user.name "${GH_USER}"
  git config user.email "${GH_USER}@users.noreply.github.com"
fi

git add .
git commit -m "chore: initial deploy" || true
git branch -M main

git remote remove origin 2>/dev/null || true
git remote add origin "${REPO_URL}"

git push -u origin main

echo "Repo push edildi: https://github.com/${GH_USER}/${REPO_NAME}"
echo "GitHub Pages workflow tetiklenecek. Ayarlar: Settings > Pages > Source: GitHub Actions"
echo "CNAME: app.aquabuddy.com (DNS CNAME: app -> ${GH_USER}.github.io)"