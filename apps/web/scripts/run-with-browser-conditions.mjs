/**
 * Chạy một script test với điều kiện export "browser" (cross-platform).
 *
 * Vì sao cần: `@apollo/client-integration-nextjs` chỉ dùng được bản trình duyệt khi Node
 * resolve theo điều kiện `browser`. Script này tự set NODE_OPTIONS và gọi tsx.
 *
 * Dùng: node scripts/run-with-browser-conditions.mjs <đường-dẫn-script.tsx>
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = process.argv[2];
if (!target) {
  console.error('Thiếu đường dẫn script cần chạy');
  process.exit(1);
}

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['tsx', '--tsconfig', 'tsconfig.scripts.json', path.resolve(here, '..', target)],
  {
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: '--conditions=browser' },
    cwd: path.resolve(here, '..'),
  },
);

process.exit(result.status ?? 1);
