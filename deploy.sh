#!/bin/bash
set -e
APP_DIR="/home/deploy/apps/saraqib-user"
cd "$APP_DIR"

echo "[$(date)] === بدء النشر ==="

# سحب آخر تحديث
GIT_SSH_COMMAND="ssh -i /home/deploy/.ssh/github_deploy -o StrictHostKeyChecking=no" \
  git pull origin main

# تثبيت كل الحزم (devDependencies ضرورية للبناء وتشغيل tsx)
npm install --legacy-peer-deps

# بناء الواجهة
npm run build

# إعادة تشغيل PM2
pm2 reload saraqib-user --update-env

echo "[$(date)] ✅ النشر اكتمل بنجاح"
