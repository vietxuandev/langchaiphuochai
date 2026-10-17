/**
 * Zod schema dùng chung: frontend dùng với react-hook-form (zodResolver),
 * backend dùng để validate input của GraphQL mutation/query.
 * Nhờ dùng chung một nguồn, rule validate FE và BE luôn khớp nhau.
 */
import { z } from 'zod';
import { PROVINCE_NAME, canonicalWardName, isValidWardName } from './address';
import { PostStatus, PostType, Role } from './enums';

/**
 * Chuỗi tuỳ chọn:
 *  - `''` hoặc `null` (người dùng để trống/xoá nội dung) → `null` để xoá giá trị trong DB
 *  - bỏ trống hẳn (undefined) → không thay đổi giá trị hiện có
 *
 * Lưu ý quan trọng: schema phải **idempotent** - giá trị đầu ra (`null`) phải parse lại được,
 * vì frontend parse bằng chính schema này rồi gửi kết quả (`null`) lên backend để parse tiếp.
 */
const optionalText = (max = 500) =>
  z.preprocess(
    (value) => (value === '' || value === null ? null : value),
    z
      .string()
      .trim()
      .max(max, `Tối đa ${max} ký tự`)
      .nullable()
      .optional(),
  );

/**
 * Đường dẫn ảnh hợp lệ: phải do máy chủ mới quản lý (`/upload/...`).
 * Nhờ vậy không còn ảnh trỏ ra domain cũ hay nguồn ngoài.
 */
const uploadPathSchema = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `Tối đa ${max} ký tự`)
    .refine((value) => value.startsWith('/upload/'), {
      message: 'Ảnh phải được tải lên máy chủ (đường dẫn bắt đầu bằng /upload/)',
    });

/** Ảnh tuỳ chọn: `''`/`null` = xoá ảnh, undefined = giữ nguyên (xem ghi chú ở `optionalText`). */
const optionalUploadPath = (max = 500) =>
  z.preprocess(
    (value) => (value === '' || value === null ? null : value),
    uploadPathSchema(max).nullable().optional(),
  );

/**
 * Xã/phường theo danh mục hành chính TP. Hồ Chí Minh (168 đơn vị).
 * Chấp nhận "Phước Hải" hoặc "Xã Phước Hải", không phân biệt dấu; lưu về tên chuẩn.
 */
const wardSchema = () =>
  z
    .string()
    .trim()
    .max(120, 'Tối đa 120 ký tự')
    .refine((value) => isValidWardName(value), {
      message: 'Xã/phường không có trong danh mục TP. Hồ Chí Minh',
    })
    .transform((value) => canonicalWardName(value) as string);

/** Xã/phường tuỳ chọn: `''`/`null` = xoá, undefined = giữ nguyên. */
const optionalWard = () =>
  z.preprocess(
    (value) => (value === '' || value === null ? null : value),
    wardSchema().nullable().optional(),
  );

/** Tỉnh/thành phố: website chỉ hỗ trợ TP. Hồ Chí Minh. */
const optionalProvince = () =>
  z.preprocess(
    (value) => (value === '' || value === null ? null : value),
    z
      .string()
      .trim()
      .refine((value) => value === PROVINCE_NAME, {
        message: `Chỉ hỗ trợ ${PROVINCE_NAME}`,
      })
      .nullable()
      .optional(),
  );

const optionalNumber = (options: { min?: number; max?: number; int?: boolean } = {}) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((value) => {
      if (value === '' || value === null || value === undefined) return undefined;
      const parsed = typeof value === 'number' ? value : Number(String(value).replace(/[^\d.-]/g, ''));
      return Number.isFinite(parsed) ? parsed : undefined;
    })
    .refine(
      (value) => value === undefined || !options.int || Number.isInteger(value),
      'Giá trị phải là số nguyên',
    )
    .refine((value) => value === undefined || options.min === undefined || value >= options.min, `Giá trị tối thiểu ${options.min}`)
    .refine((value) => value === undefined || options.max === undefined || value <= options.max, `Giá trị tối đa ${options.max}`);

/* -------------------------------------------------------------------------- */
/*                                   Chung                                    */
/* -------------------------------------------------------------------------- */

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
});
export type PaginationInput = z.infer<typeof paginationSchema>;

export const sortOrderSchema = z.enum(['ASC', 'DESC']).default('DESC');

/* -------------------------------------------------------------------------- */
/*                                    Auth                                    */
/* -------------------------------------------------------------------------- */

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Tên tối thiểu 2 ký tự').max(80, 'Tên tối đa 80 ký tự'),
    email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
    password: z
      .string()
      .min(6, 'Mật khẩu tối thiểu 6 ký tự')
      .max(72, 'Mật khẩu tối đa 72 ký tự'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu nhập lại không khớp',
    path: ['confirmPassword'],
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Tên tối thiểu 2 ký tự').max(80),
  avatarUrl: optionalUploadPath(500),
  bio: optionalText(500),
  phone: optionalText(30),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(6, 'Mật khẩu hiện tại tối thiểu 6 ký tự'),
    newPassword: z.string().min(6, 'Mật khẩu mới tối thiểu 6 ký tự').max(72),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Mật khẩu nhập lại không khớp',
    path: ['confirmPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/* -------------------------------------------------------------------------- */
/*                                Người dùng                                  */
/* -------------------------------------------------------------------------- */

export const adminCreateUserSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').max(72),
  role: z.enum([Role.ADMIN, Role.EDITOR, Role.USER]).default(Role.USER),
});
export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>;

/**
 * Trường cập nhật một phần dạng chuỗi: `''`/`null`/bỏ trống ⇒ `undefined` (KHÔNG thay đổi giá trị).
 * Khác với `optionalText` (dùng cho field được phép xoá thành `null` trong DB).
 */
const partialText = (min: number, max: number, message: string) =>
  z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    z.string().trim().min(min, message).max(max).optional(),
  );

/**
 * Cập nhật người dùng (quản trị viên).
 *
 * Lưu ý: `id` **bắt buộc** phải có trong schema. `ZodPipe` trả về `result.data` và zod loại bỏ
 * key không khai báo - thiếu `id` ở đây sẽ làm `input.id` thành `undefined` và Prisma báo lỗi
 * (đúng lỗi "đổi vai trò không hoạt động" đã gặp).
 */
export const updateUserSchema = z.object({
  id: z.string().min(1, 'Thiếu id người dùng'),
  name: partialText(2, 80, 'Tên tối thiểu 2 ký tự'),
  role: z.enum([Role.ADMIN, Role.EDITOR, Role.USER]).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/* -------------------------------------------------------------------------- */
/*                                  Danh mục                                  */
/* -------------------------------------------------------------------------- */

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2, 'Tên danh mục tối thiểu 2 ký tự').max(160),
  slug: optionalText(160),
  section: z.enum([PostType.ACCOMMODATION, PostType.NEWS, PostType.REAL_ESTATE, PostType.PAGE]),
  description: optionalText(1000),
  seoTitle: optionalText(200),
  imagePath: optionalUploadPath(500),
  parentId: optionalText(40),
  sortOrder: z.coerce.number().int().default(0),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const updateCategorySchema = categoryInputSchema.partial().extend({
  id: z.string().min(1),
});
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

/* -------------------------------------------------------------------------- */
/*                                 Bài viết                                   */
/* -------------------------------------------------------------------------- */

export const postImageInputSchema = z.object({
  /** Đường dẫn ảnh trên server mới, ví dụ "/upload/posts/2026/10/abc.jpg". */
  path: uploadPathSchema(500),
  role: z.enum(['hero', 'gallery', 'content', 'category', 'other']).default('gallery'),
  alt: optionalText(300),
  sortOrder: z.coerce.number().int().default(0),
});
export type PostImageInput = z.infer<typeof postImageInputSchema>;

export const postInputSchema = z.object({
  type: z.enum([PostType.ACCOMMODATION, PostType.NEWS, PostType.REAL_ESTATE, PostType.PAGE]),
  status: z.enum([PostStatus.DRAFT, PostStatus.PUBLISHED, PostStatus.ARCHIVED]).default(PostStatus.DRAFT),
  title: z.string().trim().min(5, 'Tiêu đề tối thiểu 5 ký tự').max(300, 'Tiêu đề tối đa 300 ký tự'),
  slug: optionalText(300),
  summary: optionalText(1000),
  contentHtml: optionalText(200_000),
  seoTitle: optionalText(300),
  seoDescription: optionalText(500),
  categoryId: optionalText(40),
  tags: z.array(z.string().trim().min(1).max(80)).max(30, 'Tối đa 30 tag').default([]),
  publishedAt: optionalText(40),

  // Địa điểm
  addressRaw: optionalText(300),
  ward: optionalWard(),
  city: optionalProvince(),

  // Giá
  priceRaw: optionalText(120),
  priceValue: optionalNumber({ min: 0, int: true }),
  priceUnit: optionalText(40),
  pricePerM2Value: optionalNumber({ min: 0, int: true }),

  // Thuộc tính nơi lưu trú / bất động sản
  areaM2: optionalNumber({ min: 0 }),
  areaText: optionalText(80),
  widthM: optionalNumber({ min: 0 }),
  lengthM: optionalNumber({ min: 0 }),
  dimensions: optionalText(80),
  bedrooms: optionalNumber({ min: 0, int: true }),
  bathrooms: optionalNumber({ min: 0, int: true }),
  floors: optionalNumber({ min: 0, int: true }),
  direction: optionalText(80),
  roadWidth: optionalText(80),
  legal: optionalText(160),
  attributes: z.record(z.string(), z.string()).default({}),

  // Liên hệ
  contactName: optionalText(160),
  contactPhone: optionalText(40),
  contactEmail: optionalText(160),
  contactZalo: optionalText(80),
  verified: z.boolean().optional(),
  hasManager: z.boolean().optional(),

  images: z.array(postImageInputSchema).max(40, 'Tối đa 40 ảnh').default([]),
});
export type PostInput = z.infer<typeof postInputSchema>;

export const createPostSchema = postInputSchema;
export type CreatePostInput = z.infer<typeof createPostSchema>;

export const updatePostSchema = postInputSchema.partial().extend({
  id: z.string().min(1),
});
export type UpdatePostInput = z.infer<typeof updatePostSchema>;

export const postFilterSchema = z.object({
  type: z
    .enum([PostType.ACCOMMODATION, PostType.NEWS, PostType.REAL_ESTATE, PostType.PAGE])
    .optional(),
  status: z.enum([PostStatus.DRAFT, PostStatus.PUBLISHED, PostStatus.ARCHIVED]).optional(),
  categoryId: optionalText(40),
  categorySlug: optionalText(160),
  ward: optionalWard(),
  tag: optionalText(80),
  keyword: optionalText(200),
  minPrice: optionalNumber({ min: 0 }),
  maxPrice: optionalNumber({ min: 0 }),
  authorId: optionalText(40),
  onlyMine: z.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
  sortBy: z.enum(['CREATED_AT', 'PUBLISHED_AT', 'PRICE', 'VIEWS', 'TITLE']).default('CREATED_AT'),
  sortOrder: z.enum(['ASC', 'DESC']).default('DESC'),
});
export type PostFilterInput = z.infer<typeof postFilterSchema>;

/* -------------------------------------------------------------------------- */
/*                              Kiểu hiển thị UI                              */
/* -------------------------------------------------------------------------- */

/** Kiểu dữ liệu trả về của `dashboardStats`. */
export interface DashboardStats {
  totalPosts: number;
  publishedPosts: number;
  draftPosts: number;
  totalUsers: number;
  totalCategories: number;
  totalViews: number;
  postsByType: { type: PostType; count: number }[];
  postsByStatus: { status: PostStatus; count: number }[];
}
