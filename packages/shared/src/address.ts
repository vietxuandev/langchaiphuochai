/**
 * Dữ liệu đơn vị hành chính cấp xã/phường của **Thành phố Hồ Chí Minh**.
 *
 * Nguồn: `data/hcm-wards.json` (168 xã/phường/đặc khu, mã tỉnh 79).
 * Việt Nam đã bỏ cấp quận/huyện từ 01/07/2025 nên hệ thống chỉ lưu:
 *   địa chỉ chi tiết → xã/phường → tỉnh/thành phố.
 *
 * Ứng dụng chỉ hỗ trợ TP. Hồ Chí Minh, vì vậy tỉnh/thành là hằng số (`PROVINCE`).
 */
import rawData from './data/hcm-wards.json';

export interface Ward {
  /** Tên đầy đủ kèm loại đơn vị, ví dụ "Xã Phước Hải". */
  name: string;
  /** Mã đơn vị hành chính (dùng để tham chiếu ổn định khi tên thay đổi). */
  code: number;
  /** "phường" | "xã" | "đặc khu". */
  divisionType: string;
  /** Tên không dấu dạng snake_case do nguồn cung cấp, ví dụ "xa_phuoc_hai". */
  codename: string;
}

export interface Province {
  name: string;
  code: number;
  divisionType: string;
}

interface RawWard {
  name: string;
  code: number;
  division_type: string;
  codename: string;
  province_code: number;
}

interface RawProvince {
  name: string;
  code: number;
  division_type: string;
  codename: string;
  phone_code?: number;
  wards: RawWard[];
}

const data = rawData as unknown as RawProvince;

/** Tỉnh/thành phố duy nhất mà website hỗ trợ. */
export const PROVINCE: Province = {
  name: 'Thành phố Hồ Chí Minh',
  code: data.code,
  divisionType: data.division_type,
};

export const PROVINCE_NAME = PROVINCE.name;

/** Toàn bộ xã/phường, sắp xếp theo tên tiếng Việt. */
export const WARDS: Ward[] = data.wards
  .map((ward) => ({
    name: ward.name,
    code: ward.code,
    divisionType: ward.division_type,
    codename: ward.codename,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

export const WARD_NAMES: string[] = WARDS.map((ward) => ward.name);

const wardByCode = new Map<number, Ward>(WARDS.map((ward) => [ward.code, ward]));
const wardByNormalizedName = new Map<string, Ward>();

/**
 * Bỏ dấu tiếng Việt + chữ thường + gộp khoảng trắng, để tìm kiếm không phân biệt dấu.
 * Ví dụ: "Xã Phước Hải" → "xa phuoc hai".
 */
export function normalizeVietnamese(input: string): string {
  return input
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Các tiền tố loại đơn vị để so khớp khi người dùng chỉ nhập tên. */
const DIVISION_PREFIXES = ['phuong ', 'xa ', 'dac khu ', 'thi tran '];

/** Bỏ tiền tố loại đơn vị: "Xã Phước Hải" → "Phước Hải". */
function stripPrefix(normalized: string): string {
  for (const prefix of DIVISION_PREFIXES) {
    if (normalized.startsWith(prefix)) return normalized.slice(prefix.length);
  }
  return normalized;
}

// Đánh index theo cả tên đầy đủ và tên không tiền tố
for (const ward of WARDS) {
  const normalized = normalizeVietnamese(ward.name);
  wardByNormalizedName.set(normalized, ward);
  const bare = stripPrefix(normalized);
  if (bare && !wardByNormalizedName.has(bare)) wardByNormalizedName.set(bare, ward);
}

/** Tìm xã/phường theo mã. */
export function findWardByCode(code: number | null | undefined): Ward | undefined {
  if (code == null) return undefined;
  return wardByCode.get(code);
}

/**
 * Tìm xã/phường theo tên, chấp nhận nhiều cách viết:
 *  - "Xã Phước Hải" (đúng chuẩn)
 *  - "Phước Hải" (thiếu tiền tố)
 *  - "xa phuoc hai" / "Xã Phước Hải " (khác dấu, hoa thường, khoảng trắng)
 *  - Tên đã lưu từ dữ liệu cũ, ví dụ "Thành Phố Hồ Chí Minh (Xem bản đồ)" → không khớp
 */
export function findWard(name: string | null | undefined): Ward | undefined {
  if (!name) return undefined;
  const normalized = normalizeVietnamese(name);
  if (!normalized) return undefined;

  const direct = wardByNormalizedName.get(normalized);
  if (direct) return direct;

  const bare = stripPrefix(normalized);
  const byBare = wardByNormalizedName.get(bare);
  if (byBare) return byBare;

  // Một số dữ liệu cũ ghi kèm hậu tố, ví dụ "Xã Phước Hải (Xem bản đồ)"
  const withoutSuffix = normalized.replace(/\s*\(.*\)\s*$/, '').trim();
  if (withoutSuffix !== normalized) {
    const bySuffix = wardByNormalizedName.get(withoutSuffix) ?? wardByNormalizedName.get(stripPrefix(withoutSuffix));
    if (bySuffix) return bySuffix;
  }

  return undefined;
}

/** Trả về tên chuẩn của xã/phường, hoặc `null` nếu không khớp dữ liệu hành chính. */
export function canonicalWardName(name: string | null | undefined): string | null {
  return findWard(name)?.name ?? null;
}

export function isValidWardName(name: string | null | undefined): boolean {
  return findWard(name) !== undefined;
}

/** Tìm kiếm xã/phường cho dropdown autocomplete (không phân biệt dấu, ưu tiên khớp đầu tên). */
export function searchWards(query: string, limit = 50): Ward[] {
  const normalizedQuery = normalizeVietnamese(query);
  if (!normalizedQuery) return WARDS.slice(0, limit);

  const startsWith: Ward[] = [];
  const contains: Ward[] = [];

  for (const ward of WARDS) {
    const normalized = normalizeVietnamese(ward.name);
    const bare = stripPrefix(normalized);
    if (normalized.startsWith(normalizedQuery) || bare.startsWith(normalizedQuery)) {
      startsWith.push(ward);
    } else if (normalized.includes(normalizedQuery)) {
      contains.push(ward);
    }
  }

  return [...startsWith, ...contains].slice(0, limit);
}

/** Nhãn hiển thị của một xã/phường. */
export function wardLabel(ward: Ward): string {
  return ward.name;
}

/**
 * Ghép địa chỉ để hiển thị: "địa chỉ chi tiết, xã/phường, tỉnh/thành phố".
 * Bỏ phần trống, không lặp lại nếu địa chỉ chi tiết đã chứa xã/phường.
 */
export function formatAddress(input: {
  addressRaw?: string | null;
  ward?: string | null;
  city?: string | null;
}): string {
  const detail = (input.addressRaw ?? '').trim().replace(/[,\s]+$/, '');
  const ward = (input.ward ?? '').trim();
  const city = (input.city ?? '').trim();

  const parts: string[] = [];
  if (detail) parts.push(detail);
  if (ward && !normalizeVietnamese(detail).includes(normalizeVietnamese(ward))) parts.push(ward);
  if (city && !normalizeVietnamese(detail).includes(normalizeVietnamese(city))) parts.push(city);

  return parts.join(', ');
}

/**
 * Bỏ các phần chỉ là đơn vị hành chính ở **cuối** chuỗi địa chỉ, giữ lại địa chỉ chi tiết.
 *
 * Ví dụ:
 *  - "khu phố Hải Sơn, Xã Phước Hải, Thành Phố Hồ Chí Minh" → "khu phố Hải Sơn"
 *  - "1093 Đ. Võ Thị Sáu, Long Hải, Hồ Chí Minh 78412, Việt Nam" → "1093 Đ. Võ Thị Sáu"
 *  - "Bãi Biển Phước Hải, lô 44A" → giữ nguyên (tên địa danh, không phải phần cuối)
 */
export function stripAdministrativeParts(
  raw: string | null | undefined,
  options: { ward?: string | null } = {},
): string {
  const text = (raw ?? '').trim();
  if (!text) return '';

  const parts = text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const wardNorm = options.ward ? normalizeVietnamese(options.ward) : null;
  const cityNorms = new Set<string>([normalizeVietnamese(PROVINCE_NAME)]);

  const isAdministrative = (normalized: string, original: string): boolean => {
    if (wardNorm && normalized === wardNorm) return true;
    if (normalized.includes('(xem ban do)')) return true;
    if (cityNorms.has(normalized)) return true;
    if (normalized.startsWith('thanh pho ho chi minh')) return true;
    if (normalized.startsWith('ho chi minh')) return true;
    if (['tp ho chi minh', 'tp.hcm', 'tphcm', 'hcm'].includes(normalized)) return true;
    if (normalized === 'viet nam' || normalized.startsWith('viet nam')) return true;
    if (/^\d{4,6}$/.test(original.replace(/\s/g, ''))) return true;
    // Tên một xã/phường khác trong danh mục (ví dụ "Long Hải") - cấp hành chính, không phải địa chỉ chi tiết
    if (normalizeVietnamese(original).length > 2 && findWard(original)) return true;
    return false;
  };

  while (parts.length > 0) {
    const last = parts[parts.length - 1];
    if (isAdministrative(normalizeVietnamese(last), last)) parts.pop();
    else break;
  }

  return parts.join(', ').replace(/^[,\s]+|[,\s]+$/g, '');
}
