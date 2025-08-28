#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 3 ]; then
  echo "Kullanım: $0 <github_kullanici_adi> <repo_adi> <github_pat>"
  exit 1
fi

GH_USER="$1"
REPO_NAME="$2"
GH_PAT="$3"

REPO_SLUG=$(echo "$REPO_NAME" | tr '[:upper:]' '[:lower:]' | sed -e 's/ /-/g' -e 's/[^a-z0-9._-]//g')
REPO_URL="https://${GH_USER}:${GH_PAT}@github.com/${GH_USER}/${REPO_SLUG}.git"

# Repo mevcut mu kontrol et; yoksa oluştur
echo "GitHub reposu kontrol ediliyor: ${GH_USER}/${REPO_SLUG}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token ${GH_PAT}" "https://api.github.com/repos/${GH_USER}/${REPO_SLUG}")
if [ "$HTTP_CODE" -eq 404 ]; then
  echo "Repo yok, oluşturuluyor..."
  CREATE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Authorization: token ${GH_PAT}" -H "Accept: application/vnd.github+json" \
    https://api.github.com/user/repos \
    -d "{\"name\":\"${REPO_SLUG}\",\"private\":false,\"has_issues\":true,\"has_projects\":false,\"has_wiki\":false}")
  if [ "$CREATE_CODE" -lt 200 ] || [ "$CREATE_CODE" -ge 300 ]; then
    echo "Repo oluşturulamadı. HTTP: $CREATE_CODE"
    exit 2
  fi
  echo "Repo oluşturuldu: https://github.com/${GH_USER}/${REPO_SLUG}"
else
  echo "Repo mevcut. (HTTP $HTTP_CODE)"
fi

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

echo "Repo push edildi: https://github.com/${GH_USER}/${REPO_SLUG}"
echo "GitHub Pages workflow tetiklenecek. Ayarlar: Settings > Pages > Source: GitHub Actions"
echo "CNAME: app.aquabuddy.com (DNS CNAME: app -> ${GH_USER}.github.io)"