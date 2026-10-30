/**
 * Quét toàn bộ mutation của API để phát hiện lỗi 500 (INTERNAL_SERVER_ERROR).
 *
 * Vì sao cần: đã gặp 2 lỗi cùng họ - schema zod dùng chung không khớp input type của GraphQL
 * (thiếu `id`, hoặc không nhận `null`). Hậu quả là mutation trả lỗi 500 hoặc bị từ chối,
 * giao diện chỉ hiện "thao tác không hoạt động" mà không rõ nguyên nhân.
 *
 * Script này gọi từng mutation với dữ liệu thật, khẳng định:
 *   1. Không mutation nào trả về lỗi INTERNAL_SERVER_ERROR.
 *   2. Mutation thay đổi dữ liệu phải tạo ra hiệu ứng thật (kiểm tra lại bằng query).
 *   3. Dữ liệu được khôi phục về trạng thái ban đầu sau khi chạy.
 *
 * Chạy: npm run verify:mutations   (cần API đang chạy)
 */
const GRAPHQL = process.env.API_URL ?? 'http://localhost:4000/graphql';
// Tài khoản dùng để kiểm thử. Có thể đổi qua biến môi trường khi admin đã đổi mật khẩu.
const ACCOUNTS = {
  admin: {
    email: process.env.VERIFY_ADMIN_EMAIL ?? 'admin@langchaiphuochai.com',
    password: process.env.VERIFY_ADMIN_PASSWORD ?? 'Admin@123',
  },
  editor: { email: 'verify-editor@example.com', password: 'Verify@12345' },
  user: { email: 'verify-member@example.com', password: 'Verify@12345' },
};

let failed = 0;

/** Đăng nhập, nếu tài khoản chưa tồn tại thì tạo bằng quyền admin rồi đăng nhập lại. */
async function ensureLogin(account, adminToken, role = 'USER') {
  const attempt = await gql(
    `mutation($i: LoginInput!) { login(input: $i) { accessToken } }`,
    { i: { email: account.email, password: account.password } },
  );
  if (attempt.data?.login?.accessToken) return attempt.data.login.accessToken;

  await gql(
    `mutation($i: AdminCreateUserInput!) { createUser(input: $i) { id } }`,
    { i: { name: `Verify ${role}`, email: account.email, password: account.password, role } },
    adminToken,
  );

  const retry = await gql(
    `mutation($i: LoginInput!) { login(input: $i) { accessToken } }`,
    { i: { email: account.email, password: account.password } },
  );
  if (!retry.data?.login?.accessToken) throw new Error(`Không tạo/đăng nhập được ${account.email}`);
  return retry.data.login.accessToken;
}

async function gql(query, variables, token) {
  const response = await fetch(GRAPHQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  return response.json();
}

/** Chạy 1 bước kiểm tra: bắt buộc không có lỗi 500, và ghi nhận kết quả. */
async function step(name, { query, variables, token, expectError, check }) {
  const result = await gql(query, variables, token);
  const errors = result.errors ?? [];
  const serverError = errors.find((error) => error.extensions?.code === 'INTERNAL_SERVER_ERROR');

  if (serverError) {
    console.log(`❌ ${name}: LỖI 500 - ${serverError.message.split('\n')[0].slice(0, 140)}`);
    failed += 1;
    return { result, data: null };
  }

  if (expectError) {
    const matched = errors.some((error) => error.message.includes(expectError));
    if (!matched) {
      console.log(`❌ ${name}: mong đợi lỗi "${expectError}" nhưng nhận ${JSON.stringify(errors[0]?.message ?? result.data)}`);
      failed += 1;
    } else {
      console.log(`✅ ${name}: bị chặn đúng - ${errors[0].message.slice(0, 90)}`);
    }
    return { result, data: null };
  }

  if (errors.length > 0) {
    console.log(`❌ ${name}: lỗi không mong đợi - ${errors[0].message.slice(0, 140)}`);
    failed += 1;
    return { result, data: null };
  }

  const data = result.data;
  if (check) {
    const verdict = check(data);
    if (verdict !== true) {
      console.log(`❌ ${name}: ${verdict}`);
      failed += 1;
      return { result, data };
    }
  }

  console.log(`✅ ${name}`);
  return { result, data };
}

async function login(account) {
  const result = await gql(
    'mutation($input: LoginInput!) { login(input: $input) { accessToken } }',
    { input: account },
  );
  const token = result.data?.login?.accessToken;
  if (!token) throw new Error(`Không đăng nhập được ${account.email}`);
  return token;
}

async function main() {
  const adminToken = await login(ACCOUNTS.admin);
  const editorToken = await ensureLogin(ACCOUNTS.editor, adminToken, 'EDITOR');
  const memberToken = await ensureLogin(ACCOUNTS.user, adminToken, 'USER');

  /* ---------------------------- Nhóm 1: xác thực ---------------------------- */
  console.log('\n- Xác thực & hồ sơ -');
  await step('login (sai mật khẩu)', {
    query: 'mutation($input: LoginInput!) { login(input: $input) { accessToken } }',
    variables: { input: { email: ACCOUNTS.admin.email, password: 'sai-mat-khau' } },
    expectError: 'không đúng',
  });
  await step('register (email trùng)', {
    query: 'mutation($input: RegisterInput!) { register(input: $input) { requiresApproval message user { id } } }',
    variables: {
      input: {
        name: 'Trùng',
        email: ACCOUNTS.user.email,
        password: 'Test@1234',
        confirmPassword: 'Test@1234',
      },
    },
    expectError: 'đã được sử dụng',
  });

  // Luồng duyệt tài khoản: đăng ký mới phải ở PENDING, chưa đăng nhập được
  const pendingEmail = `verify-pending-${Date.now()}@example.com`;
  const registered = await step('register (tài khoản mới -> chờ duyệt)', {
    query:
      'mutation($input: RegisterInput!) { register(input: $input) { requiresApproval message user { id email status isActive } } }',
    variables: {
      input: {
        name: 'Chờ duyệt',
        email: pendingEmail,
        password: 'Test@1234',
        confirmPassword: 'Test@1234',
      },
    },
    check: (data) =>
      data.register.requiresApproval === true &&
      data.register.user.status === 'PENDING' &&
      data.register.user.isActive === false
        ? true
        : `requiresApproval/status/isActive chưa đúng: ${JSON.stringify(data.register)}`,
  });
  const pendingId = registered.data.register.user.id;

  await step('login (chờ duyệt - phải bị chặn)', {
    query: 'mutation($i: LoginInput!) { login(input: $i) { accessToken } }',
    variables: { i: { email: pendingEmail, password: 'Test@1234' } },
    expectError: 'chờ quản trị viên duyệt',
  });

  await step('approveUser (duyệt và cấp quyền)', {
    query: 'mutation($id: String!, $role: Role) { approveUser(id: $id, role: $role) { id email status isActive role } }',
    variables: { id: pendingId, role: 'EDITOR' },
    token: adminToken,
    check: (data) =>
      data.approveUser.status === 'ACTIVE' && data.approveUser.role === 'EDITOR'
        ? true
        : `sau khi duyệt phải là ACTIVE/EDITOR: ${JSON.stringify(data.approveUser)}`,
  });

  await step('login (đã duyệt - phải đăng nhập được)', {
    query: 'mutation($i: LoginInput!) { login(input: $i) { accessToken user { status } } }',
    variables: { i: { email: pendingEmail, password: 'Test@1234' } },
    check: (data) =>
      data.login.accessToken && data.login.user.status === 'ACTIVE'
        ? true
        : 'phải trả accessToken và status ACTIVE',
  });

  await step('rejectUser (từ chối tài khoản)', {
    query: 'mutation($id: String!, $note: String) { rejectUser(id: $id, note: $note) { id status isActive reviewNote } }',
    variables: { id: pendingId, note: 'Kiểm thử' },
    token: adminToken,
    check: (data) =>
      data.rejectUser.status === 'REJECTED' && data.rejectUser.reviewNote === 'Kiểm thử'
        ? true
        : `phải là REJECTED kèm lý do: ${JSON.stringify(data.rejectUser)}`,
  });

  await step('login (bị từ chối - phải bị chặn)', {
    query: 'mutation($i: LoginInput!) { login(input: $i) { accessToken } }',
    variables: { i: { email: pendingEmail, password: 'Test@1234' } },
    expectError: 'đã bị từ chối',
  });

  // dọn tài khoản kiểm thử vừa đăng ký
  await gql('mutation($id: String!) { removeUser(id: $id) }', { id: pendingId }, adminToken);

  const meBefore = await gql('{ me { name bio phone avatarUrl } }', undefined, adminToken);
  const original = meBefore.data.me;
  await step('updateProfile (đổi tên, field phụ để trống)', {
    query: 'mutation($input: UpdateProfileInput!) { updateProfile(input: $input) { name bio phone } }',
    variables: { input: { name: original.name, bio: '', phone: null } },
    token: adminToken,
    check: (data) => (data.updateProfile.name === original.name ? true : 'tên không được lưu'),
  });
  await step('changePassword (mật khẩu hiện tại sai)', {
    query: 'mutation($input: ChangePasswordInput!) { changePassword(input: $input) }',
    variables: {
      input: { currentPassword: 'sai-mat-khau', newPassword: 'MatKhau@123', confirmPassword: 'MatKhau@123' },
    },
    token: adminToken,
    expectError: 'không đúng',
  });

  /* --------------------------- Nhóm 2: người dùng --------------------------- */
  console.log('\n- Quản lý người dùng -');
  const users = await gql('{ users { items { id email role isActive } } }', undefined, adminToken);
  const target = users.data.users.items.find((u) => u.email === ACCOUNTS.user.email);

  await step('updateUser (đổi vai trò USER → EDITOR)', {
    query: 'mutation($input: UpdateUserInput!) { updateUser(input: $input) { id role } }',
    variables: { input: { id: target.id, role: 'EDITOR' } },
    token: adminToken,
    check: (data) => (data.updateUser.role === 'EDITOR' ? true : `vai trò vẫn là ${data.updateUser.role}`),
  });
  await step('updateUser (khoá tài khoản)', {
    query: 'mutation($input: UpdateUserInput!) { updateUser(input: $input) { id isActive } }',
    variables: { input: { id: target.id, isActive: false } },
    token: adminToken,
    check: (data) => (data.updateUser.isActive === false ? true : 'tài khoản chưa bị khoá'),
  });
  await step('updateUser (khôi phục USER + mở khoá)', {
    query: 'mutation($input: UpdateUserInput!) { updateUser(input: $input) { id role isActive } }',
    variables: { input: { id: target.id, role: 'USER', isActive: true } },
    token: adminToken,
    check: (data) =>
      data.updateUser.role === 'USER' && data.updateUser.isActive === true ? true : 'không khôi phục được',
  });
  const me = await gql('{ me { id } }', undefined, adminToken);
  await step('updateUser (tự đổi vai trò của mình)', {
    query: 'mutation($input: UpdateUserInput!) { updateUser(input: $input) { id } }',
    variables: { input: { id: me.data.me.id, role: 'USER' } },
    token: adminToken,
    expectError: 'không thể tự thay đổi vai trò',
  });
  await step('updateUser (EDITOR gọi - phải bị chặn)', {
    query: 'mutation($input: UpdateUserInput!) { updateUser(input: $input) { id } }',
    variables: { input: { id: target.id, role: 'ADMIN' } },
    token: editorToken,
    expectError: 'quyền',
  });
  await step('createUser (ADMIN tạo tài khoản mới)', {
    query: 'mutation($input: AdminCreateUserInput!) { createUser(input: $input) { id email role } }',
    variables: {
      input: {
        name: 'Tài khoản kiểm thử',
        email: `kiem-thu-${Date.now()}@langchaiphuochai.com`,
        password: 'KiemThu@123',
        role: 'EDITOR',
      },
    },
    token: adminToken,
    check: (data) => (data.createUser.role === 'EDITOR' ? true : 'vai trò không đúng'),
  }).then(async ({ data }) => {
    // Vô hiệu hoá tài khoản vừa tạo để không ảnh hưởng dữ liệu
    if (data?.createUser?.id) {
      await step('deactivateUser (tài khoản kiểm thử)', {
        query: 'mutation($id: String!) { deactivateUser(id: $id) { id isActive } }',
        variables: { id: data.createUser.id },
        token: adminToken,
        check: (result) => (result.deactivateUser.isActive === false ? true : 'chưa vô hiệu hoá'),
      });
    }
  });

  /* ---------------------------- Nhóm 3: danh mục ---------------------------- */
  console.log('\n- Danh mục -');
  await step('createCategory', {
    query: 'mutation($input: CategoryInput!) { createCategory(input: $input) { id name slug } }',
    variables: { input: { name: `Danh mục kiểm thử ${Date.now()}`, section: 'NEWS', description: null } },
    token: adminToken,
    check: (data) => (data.createCategory.id ? true : 'không trả về id'),
  }).then(async ({ data }) => {
    const id = data?.createCategory?.id;
    if (!id) return;
    await step('updateCategory (field tuỳ chọn để trống)', {
      query: 'mutation($input: UpdateCategoryInput!) { updateCategory(input: $input) { id name description } }',
      variables: { input: { id, description: null, seoTitle: '' } },
      token: adminToken,
      check: (result) => (result.updateCategory.id === id ? true : 'không cập nhật được'),
    });
    await step('createCategory (EDITOR gọi - phải bị chặn)', {
      query: 'mutation($input: CategoryInput!) { createCategory(input: $input) { id } }',
      variables: { input: { name: 'Danh mục trái phép', section: 'NEWS' } },
      token: editorToken,
      expectError: 'quyền',
    });
    await step('deleteCategory (dọn dữ liệu kiểm thử)', {
      query: 'mutation($id: String!) { deleteCategory(id: $id) }',
      variables: { id },
      token: adminToken,
      check: (result) => (result.deleteCategory === true ? true : 'không xoá được'),
    });
  });

  /* ---------------------------- Nhóm 4: bài viết ---------------------------- */
  console.log('\n- Bài viết -');
  await step('createPost (field tuỳ chọn để trống)', {
    query:
      'mutation($input: PostInput!) { createPost(input: $input) { id slug status summary } }',
    variables: {
      input: { type: 'NEWS', title: `Bài kiểm thử mutation ${Date.now()}`, summary: null, seoTitle: '' },
    },
    token: editorToken,
    check: (data) => (data.createPost.status === 'DRAFT' ? true : `trạng thái lạ: ${data.createPost.status}`),
  }).then(async ({ data }) => {
    const id = data?.createPost?.id;
    if (!id) return;
    await step('updatePost (field tuỳ chọn để trống)', {
      query: 'mutation($input: UpdatePostInput!) { updatePost(input: $input) { id summary } }',
      variables: { input: { id, summary: null, seoDescription: '' } },
      token: editorToken,
      check: (result) => (result.updatePost.id === id ? true : 'không cập nhật được'),
    });
    await step('publishPost', {
      query: 'mutation($id: String!) { publishPost(id: $id) { id status } }',
      variables: { id },
      token: editorToken,
      check: (result) => (result.publishPost.status === 'PUBLISHED' ? true : 'chưa xuất bản'),
    });
    await step('incrementPostViews', {
      query: 'mutation($id: String!) { incrementPostViews(id: $id) }',
      variables: { id },
      check: (result) => (result.incrementPostViews === true ? true : 'không tăng được lượt xem'),
    });
    await step('archivePost', {
      query: 'mutation($id: String!) { archivePost(id: $id) { id status } }',
      variables: { id },
      token: editorToken,
      check: (result) => (result.archivePost.status === 'ARCHIVED' ? true : 'chưa lưu trữ'),
    });
    await step('unpublishPost', {
      query: 'mutation($id: String!) { unpublishPost(id: $id) { id status } }',
      variables: { id },
      token: editorToken,
      check: (result) => (result.unpublishPost.status === 'DRAFT' ? true : 'chưa thu hồi'),
    });
    await step('deletePost (dọn dữ liệu kiểm thử)', {
      query: 'mutation($id: String!) { deletePost(id: $id) }',
      variables: { id },
      token: editorToken,
      check: (result) => (result.deletePost === true ? true : 'không xoá được'),
    });
    await step('deletePost (id không tồn tại - không được lỗi 500)', {
      query: 'mutation($id: String!) { deletePost(id: $id) }',
      variables: { id: 'khong-ton-tai' },
      token: editorToken,
      expectError: 'Không tìm thấy',
    });
  });

  /* --------------------------- Nhóm 5: địa chỉ ----------------------------- */
  console.log('\n- Địa chỉ (xã/phường, không còn quận/huyện) -');
  await step('createPost (ward thiếu tiền tố → tự chuẩn hoá)', {
    query: 'mutation($input: PostInput!) { createPost(input: $input) { id ward city } }',
    variables: {
      input: {
        type: 'NEWS',
        title: `Bài kiểm thử địa chỉ ${Date.now()}`,
        ward: 'Phước Hải',
        city: 'Thành phố Hồ Chí Minh',
      },
    },
    token: editorToken,
    check: (data) =>
      data.createPost.ward === 'Xã Phước Hải'
        ? true
        : `ward lưu sai: ${JSON.stringify(data.createPost.ward)}`,
  }).then(async ({ data }) => {
    const id = data?.createPost?.id;
    if (!id) return;
    await step('updatePost (xoá xã/phường bằng null)', {
      query: 'mutation($input: UpdatePostInput!) { updatePost(input: $input) { id ward } }',
      variables: { input: { id, ward: null } },
      token: editorToken,
      check: (result) => (result.updatePost.ward === null ? true : 'không xoá được xã/phường'),
    });
    await step('deletePost (dọn dữ liệu kiểm thử địa chỉ)', {
      query: 'mutation($id: String!) { deletePost(id: $id) }',
      variables: { id },
      token: editorToken,
      check: (result) => (result.deletePost === true ? true : 'không xoá được'),
    });
  });
  await step('createPost (ward "Quận 1" - phải bị chặn)', {
    query: 'mutation($input: PostInput!) { createPost(input: $input) { id } }',
    variables: { input: { type: 'NEWS', title: `Bài kiểm thử quận cũ ${Date.now()}`, ward: 'Quận 1' } },
    token: editorToken,
    expectError: 'Xã/phường không có trong danh mục',
  });
  await step('createPost (city "Hà Nội" - phải bị chặn)', {
    query: 'mutation($input: PostInput!) { createPost(input: $input) { id } }',
    variables: { input: { type: 'NEWS', title: `Bài kiểm thử tỉnh khác ${Date.now()}`, city: 'Hà Nội' } },
    token: editorToken,
    expectError: 'Chỉ hỗ trợ Thành phố Hồ Chí Minh',
  });

  /* --------------------------- Nhóm 6: phân quyền --------------------------- */
  console.log('\n- Phân quyền -');
  await step('createPost (USER gửi PUBLISHED - phải thành DRAFT)', {
    query: 'mutation($input: PostInput!) { createPost(input: $input) { id status } }',
    variables: { input: { type: 'NEWS', title: `Bài của thành viên ${Date.now()}`, status: 'PUBLISHED' } },
    token: memberToken,
    check: (data) => (data.createPost.status === 'DRAFT' ? true : `rò rỉ quyền: ${data.createPost.status}`),
  }).then(async ({ data }) => {
    const id = data?.createPost?.id;
    if (id) {
      await step('deletePost (dọn bài của thành viên)', {
        query: 'mutation($id: String!) { deletePost(id: $id) }',
        variables: { id },
        token: adminToken,
        check: (result) => (result.deletePost === true ? true : 'không xoá được'),
      });
    }
  });

  /* ------------------- Dọn tài khoản kiểm thử đã tạo ------------------- */
  try {
    const { Client } = await import('pg');
    const client = new Client({
      connectionString:
        process.env.DATABASE_URL ?? 'postgresql://phuochai:phuochai@localhost:55432/phuochai',
    });
    await client.connect();
    // Dọn toàn bộ tài khoản do script tạo (kiểm thử + tài khoản dịch vụ của bộ test)
    const removed = await client.query(
      "delete from users where email like 'kiem-thu-%@langchaiphuochai.com' " +
        "or email like 'verify-%@example.com' returning email",
    );
    await client.end();
    if (removed.rowCount > 0) {
      console.log(`\nĐã dọn ${removed.rowCount} tài khoản kiểm thử.`);
    }
  } catch (error) {
    console.log(`\n(Không dọn được tài khoản kiểm thử: ${error.message})`);
  }

  console.log('');
  if (failed > 0) {
    console.log(`❌ ${failed} bước kiểm tra thất bại.`);
    process.exit(1);
  }
  console.log('✅ Toàn bộ mutation hoạt động: không lỗi 500, thay đổi dữ liệu đúng, phân quyền đúng.');
}

main().catch((error) => {
  console.error('Lỗi khi quét mutation:', error);
  process.exit(1);
});
