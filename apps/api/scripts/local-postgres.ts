/**
 * Chạy PostgreSQL "nhúng" (embedded-postgres) cho môi trường dev không có Docker.
 *
 *   npm run db:local -w @phuochai/api
 *
 * Dữ liệu được lưu tại `phuochai-web/data/pgdata`, cổng mặc định 55432.
 * Sau khi script khởi động, đặt DATABASE_URL trong `apps/api/.env`:
 *   DATABASE_URL="postgresql://phuochai:phuochai@localhost:55432/phuochai?schema=public"
 *
 * Nhấn Ctrl+C để dừng (dữ liệu vẫn được giữ lại nhờ `persistent: true`).
 */
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const dataDir = process.env.PG_DATA_DIR ?? join(process.cwd(), '../../data/pgdata');
const port = Number.parseInt(process.env.PG_PORT ?? '55432', 10);
const user = process.env.PG_USER ?? 'phuochai';
const password = process.env.PG_PASSWORD ?? 'phuochai';
const database = process.env.PG_DATABASE ?? 'phuochai';

async function main(): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  const alreadyInitialised = existsSync(join(dataDir, 'PG_VERSION'));

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user,
    password,
    port,
    persistent: true,
  });

  if (!alreadyInitialised) {
    console.log(`→ Khởi tạo cụm PostgreSQL mới tại ${dataDir}`);
    await pg.initialise();
  } else {
    console.log(`→ Dùng lại cụm PostgreSQL đã có tại ${dataDir}`);
  }

  await pg.start();
  console.log(`✔ PostgreSQL đang chạy tại localhost:${port} (user: ${user})`);

  try {
    await pg.createDatabase(database);
    console.log(`✔ Đã tạo database "${database}"`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/already exists/i.test(message)) {
      console.log(`ℹ Database "${database}" đã tồn tại, bỏ qua`);
    } else {
      console.warn(`⚠ Không tạo được database: ${message}`);
    }
  }

  console.log('');
  console.log('DATABASE_URL cần dùng:');
  console.log(`  postgresql://${user}:${password}@localhost:${port}/${database}?schema=public`);
  console.log('');
  console.log('Nhấn Ctrl+C để dừng PostgreSQL.');

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n→ Nhận ${signal}, đang dừng PostgreSQL...`);
    try {
      await pg.stop();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  // Giữ tiến trình chạy
  setInterval(() => undefined, 60_000);
}

main().catch((error) => {
  console.error('Không khởi động được PostgreSQL nhúng:', error);
  process.exit(1);
});
