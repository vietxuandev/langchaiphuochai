/**
 * Enum dùng chung giữa backend và frontend.
 * Giá trị string phải khớp 1-1 với enum trong GraphQL schema.
 */

export const Role = {
  ADMIN: 'ADMIN',
  EDITOR: 'EDITOR',
  USER: 'USER',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

/** Trạng thái duyệt tài khoản: đăng ký mới phải được quản trị viên duyệt. */
export const UserStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  REJECTED: 'REJECTED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const PostType = {
  ACCOMMODATION: 'ACCOMMODATION',
  NEWS: 'NEWS',
  REAL_ESTATE: 'REAL_ESTATE',
  PAGE: 'PAGE',
} as const;
export type PostType = (typeof PostType)[keyof typeof PostType];

export const PostStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type PostStatus = (typeof PostStatus)[keyof typeof PostStatus];

export const MediaRole = {
  HERO: 'hero',
  GALLERY: 'gallery',
  CONTENT: 'content',
  CATEGORY: 'category',
  OTHER: 'other',
} as const;
export type MediaRole = (typeof MediaRole)[keyof typeof MediaRole];

/** Loại thông báo quản trị (giá trị khớp enum Prisma/GraphQL). */
export const NotificationType = {
  USER_PENDING: 'USER_PENDING',
  POST_PENDING: 'POST_PENDING',
  POST_PUBLISHED: 'POST_PUBLISHED',
  SECURITY_LOGIN_FAILED: 'SECURITY_LOGIN_FAILED',
  CRAWL_COMPLETED: 'CRAWL_COMPLETED',
  CRAWL_FAILED: 'CRAWL_FAILED',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const NotificationSeverity = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  URGENT: 'URGENT',
} as const;
export type NotificationSeverity = (typeof NotificationSeverity)[keyof typeof NotificationSeverity];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  [NotificationType.USER_PENDING]: 'Tài khoản mới chờ duyệt',
  [NotificationType.POST_PENDING]: 'Bài viết chờ duyệt',
  [NotificationType.POST_PUBLISHED]: 'Bài viết đã xuất bản',
  [NotificationType.SECURITY_LOGIN_FAILED]: 'Cảnh báo đăng nhập',
  [NotificationType.CRAWL_COMPLETED]: 'Crawl hoàn tất',
  [NotificationType.CRAWL_FAILED]: 'Crawl thất bại',
  [NotificationType.UPLOAD_FAILED]: 'Upload thất bại',
  [NotificationType.SYSTEM_ERROR]: 'Lỗi hệ thống',
};

export const NOTIFICATION_SEVERITY_LABELS: Record<NotificationSeverity, string> = {
  [NotificationSeverity.INFO]: 'Thông tin',
  [NotificationSeverity.WARNING]: 'Cảnh báo',
  [NotificationSeverity.URGENT]: 'Khẩn cấp',
};


export const ROLE_LABELS: Record<Role, string> = {
  [Role.ADMIN]: 'Quản trị viên',
  [Role.EDITOR]: 'Người đăng bài',
  [Role.USER]: 'Thành viên',
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  [UserStatus.PENDING]: 'Chờ duyệt',
  [UserStatus.ACTIVE]: 'Đang hoạt động',
  [UserStatus.REJECTED]: 'Bị từ chối',
};

export const POST_TYPE_LABELS: Record<PostType, string> = {
  [PostType.ACCOMMODATION]: 'Nơi lưu trú',
  [PostType.NEWS]: 'Tin tức & cẩm nang',
  [PostType.REAL_ESTATE]: 'Bất động sản',
  [PostType.PAGE]: 'Trang thông tin',
};

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  [PostStatus.DRAFT]: 'Bản nháp',
  [PostStatus.PUBLISHED]: 'Đã đăng',
  [PostStatus.ARCHIVED]: 'Lưu trữ',
};

/** Đường dẫn public tương ứng với từng loại nội dung. */
export const POST_TYPE_PATHS: Record<PostType, string> = {
  [PostType.ACCOMMODATION]: '/luu-tru',
  [PostType.NEWS]: '/tin-tuc',
  [PostType.REAL_ESTATE]: '/bat-dong-san',
  [PostType.PAGE]: '/trang',
};

/** Thứ tự ưu tiên khi phân quyền (số lớn hơn = quyền cao hơn). */
export const ROLE_WEIGHT: Record<Role, number> = {
  [Role.USER]: 1,
  [Role.EDITOR]: 2,
  [Role.ADMIN]: 3,
};

export function hasAtLeastRole(role: Role | null | undefined, required: Role): boolean {
  if (!role) return false;
  return ROLE_WEIGHT[role] >= ROLE_WEIGHT[required];
}

/** Người dùng có được phép xuất bản bài viết không. */
export function canPublish(role: Role | null | undefined): boolean {
  return hasAtLeastRole(role, Role.EDITOR);
}

/** Người dùng có được phép quản lý danh mục / người dùng không. */
export function canManageSystem(role: Role | null | undefined): boolean {
  return role === Role.ADMIN;
}
