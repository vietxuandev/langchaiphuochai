#!/bin/sh
# Entrypoint của image API.
#
# Container khởi động bằng root CHỈ để sửa quyền thư mục dữ liệu (volume từ host), rồi chạy
# ứng dụng bằng user `node` (uid 1000) - ứng dụng không bao giờ chạy bằng root.
#
# Bản cũ chạy bằng root nên ảnh đã upload trong DATA_DIR thuộc root; lần khởi động đầu tiên
# sau khi cập nhật sẽ chuyển quyền một lần (các lần sau bỏ qua vì đã đúng chủ sở hữu).
set -e

DATA_DIR="${APP_DATA_DIR:-/app/data}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR/upload"
  if [ -n "$(find "$DATA_DIR" ! -user node -print -quit 2>/dev/null)" ]; then
    echo "[entrypoint] Chuyển quyền $DATA_DIR cho user node (uid 1000)..."
    chown -R node:node "$DATA_DIR" || echo "[entrypoint] Cảnh báo: không chuyển được quyền $DATA_DIR"
  fi
  export HOME=/home/node
  exec su-exec node "$@"
fi

exec "$@"
