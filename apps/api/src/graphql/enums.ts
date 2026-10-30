import { registerEnumType } from '@nestjs/graphql';
import { PostStatus, PostType, Role, UserStatus } from '@phuochai/shared';

/** Đăng ký enum dùng chung với GraphQL schema (code-first). */
registerEnumType(Role, {
  name: 'Role',
  description: 'Vai trò người dùng: ADMIN (quản trị), EDITOR (người đăng bài), USER (thành viên)',
  valuesMap: {
    ADMIN: { description: 'Quản trị viên - toàn quyền hệ thống' },
    EDITOR: { description: 'Người đăng bài - tạo, sửa và xuất bản bài viết' },
    USER: { description: 'Thành viên - chỉ tạo bản nháp và quản lý hồ sơ' },
  },
});

registerEnumType(PostType, {
  name: 'PostType',
  description: 'Loại nội dung',
  valuesMap: {
    ACCOMMODATION: { description: 'Nơi lưu trú (khách sạn, homestay, villa...)' },
    NEWS: { description: 'Tin tức & cẩm nang du lịch' },
    REAL_ESTATE: { description: 'Bất động sản' },
    PAGE: { description: 'Trang thông tin tĩnh' },
  },
});

registerEnumType(UserStatus, {
  name: 'UserStatus',
  description: 'Trạng thái duyệt tài khoản',
  valuesMap: {
    PENDING: { description: 'Đăng ký mới, chờ quản trị viên duyệt' },
    ACTIVE: { description: 'Đã duyệt, được đăng nhập' },
    REJECTED: { description: 'Bị từ chối' },
  },
});

registerEnumType(PostStatus, {
  name: 'PostStatus',
  description: 'Trạng thái bài viết',
  valuesMap: {
    DRAFT: { description: 'Bản nháp - chưa hiển thị công khai' },
    PUBLISHED: { description: 'Đã xuất bản' },
    ARCHIVED: { description: 'Lưu trữ' },
  },
});

/** Kiểu sắp xếp dùng cho danh sách (giá trị trùng tên enum để FE/BE dùng chung). */
export enum SortDirection {
  ASC = 'ASC',
  DESC = 'DESC',
}
registerEnumType(SortDirection, {
  name: 'SortDirection',
  description: 'Thứ tự sắp xếp',
  valuesMap: {
    ASC: { description: 'Tăng dần' },
    DESC: { description: 'Giảm dần' },
  },
});

/** Trường có thể sắp xếp. */
export enum PostSortField {
  CREATED_AT = 'CREATED_AT',
  PUBLISHED_AT = 'PUBLISHED_AT',
  PRICE = 'PRICE',
  VIEWS = 'VIEWS',
  TITLE = 'TITLE',
}
registerEnumType(PostSortField, {
  name: 'PostSortField',
  description: 'Trường sắp xếp danh sách bài viết',
  valuesMap: {
    CREATED_AT: { description: 'Ngày tạo' },
    PUBLISHED_AT: { description: 'Ngày xuất bản' },
    PRICE: { description: 'Giá' },
    VIEWS: { description: 'Lượt xem' },
    TITLE: { description: 'Tiêu đề' },
  },
});
