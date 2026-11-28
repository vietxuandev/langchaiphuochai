#!/usr/bin/env bash
# Backup hằng tuần lên Cloudflare R2 bằng restic (mã hoá phía client).
# Chạy bằng root trên máy Pi (cron). Cấu hình ở /etc/phuochai-backup.env.
#
# Sao lưu:
#   - DB phuochai      (pg_dump -Fc, tag: db)
#   - DB của Coolify   (pg_dump -Fc, tag: coolify)
#   - Ảnh upload + file env của Coolify (tag: files)
set -euo pipefail

ENV_FILE="${BACKUP_ENV_FILE:-/etc/phuochai-backup.env}"
# shellcheck disable=SC1090
set -a && source "$ENV_FILE" && set +a

: "${RESTIC_REPOSITORY:?}" "${RESTIC_PASSWORD:?}" "${AWS_ACCESS_KEY_ID:?}" "${AWS_SECRET_ACCESS_KEY:?}"
: "${APP_COMPOSE_PROJECT:?}" "${DATA_DIR:?}"

ping_hc() { [ -n "${HC_URL:-}" ] && curl -fsS -m 10 --retry 3 "${HC_URL}${1:-}" >/dev/null || true; }
trap 'echo "[backup] LỖI ở dòng $LINENO"; ping_hc /fail' ERR

exec 9>/var/lock/phuochai-backup.lock
flock -n 9 || { echo "[backup] đang có tiến trình khác chạy"; exit 1; }

ping_hc /start
echo "[backup] bắt đầu $(date -Is)"

# Tên container đổi sau mỗi lần deploy nên tìm theo label của compose project.
DB_CONTAINER="$(docker ps --filter "label=com.docker.compose.project=${APP_COMPOSE_PROJECT}" \
  --filter "label=com.docker.compose.service=db" --format '{{.Names}}' | head -n1)"
[ -n "$DB_CONTAINER" ] || { echo "[backup] không tìm thấy container db của ${APP_COMPOSE_PROJECT}"; exit 1; }

dump() {
  docker exec "$1" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc'
}

echo "[backup] DB ứng dụng (${DB_CONTAINER})"
dump "$DB_CONTAINER" | restic backup --stdin --stdin-filename phuochai.dump --tag db

if docker inspect coolify-db >/dev/null 2>&1; then
  echo "[backup] DB Coolify"
  dump coolify-db | restic backup --stdin --stdin-filename coolify.dump --tag coolify
fi

echo "[backup] Ảnh upload và cấu hình"
FILES=("${DATA_DIR}/upload")
for f in /data/coolify/source/.env /home/ubuntu/coolify-env-backup; do
  [ -e "$f" ] && FILES+=("$f")
done
restic backup --tag files "${FILES[@]}"

echo "[backup] Dọn bản cũ"
restic forget --prune --keep-weekly "${KEEP_WEEKLY:-8}" --keep-monthly "${KEEP_MONTHLY:-6}"

# Đọc thử 5% dữ liệu để phát hiện hỏng sớm
restic check --read-data-subset=5%

echo "[backup] xong $(date -Is)"
ping_hc
