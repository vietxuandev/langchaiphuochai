/**
 * Kiểm thử MCP server (Phase 1): xác thực, handshake, tool, bảo mật, idempotency.
 *
 * Chạy: npm run verify:mcp   (cần API đang chạy, mặc định http://localhost:4000)
 *
 * Script tự tạo token qua GraphQL admin, gọi JSON-RPC trực tiếp vào /mcp,
 * kiểm tra dữ liệu trong DB qua GraphQL rồi dọn sạch (bài + token) sau khi chạy.
 */
const API = process.env.API_URL ?? 'http://localhost:4000';
const GRAPHQL = `${API}/graphql`;
const MCP = `${API}/mcp`;

const ADMIN = {
  email: process.env.VERIFY_ADMIN_EMAIL ?? 'admin@langchaiphuochai.com',
  password: process.env.VERIFY_ADMIN_PASSWORD ?? 'Admin@123',
};

let failed = 0;
let passed = 0;

function ok(name, detail = '') {
  passed += 1;
  console.log(`✅ ${name}${detail ? `: ${detail}` : ''}`);
}

function fail(name, detail) {
  failed += 1;
  console.log(`❌ ${name}: ${detail}`);
}

/** Gọi GraphQL (dùng chung cho login và kiểm tra dữ liệu). */
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

/** Gọi MCP endpoint; trả cả status, headers và JSON. */
async function mcpRequest(token, body) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(MCP, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await response.text();
  let json = null;
  if (text.trim().startsWith('{')) {
    json = JSON.parse(text);
  } else if (text.includes('data:')) {
    // Phòng trường hợp server trả SSE
    const line = text.split('\n').find((item) => item.startsWith('data:'));
    json = line ? JSON.parse(line.slice(5).trim()) : null;
  }
  return { status: response.status, headers: response.headers, body: json };
}

/** Gọi tool và trả nội dung text đã parse JSON. */
async function callTool(token, name, args) {
  const response = await mcpRequest(token, {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: { name, arguments: args },
  });
  const result = response.body?.result;
  const text = result?.content?.[0]?.text ?? '';
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { status: response.status, isError: Boolean(result?.isError), data };
}

async function main() {
  console.log('\n- Xác thực MCP -');

  // 1) Không token -> 401 kèm WWW-Authenticate
  const noToken = await mcpRequest(null, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  const challenge = noToken.headers.get('www-authenticate') ?? '';
  if (noToken.status === 401) ok('Không token -> 401');
  else fail('Không token -> 401', `nhận ${noToken.status}`);
  if (challenge.includes('resource_metadata=')) ok('WWW-Authenticate có resource_metadata');
  else fail('WWW-Authenticate có resource_metadata', challenge || '(không có header)');

  // 2) Metadata RFC 9728
  const metadata = await fetch(`${API}/.well-known/oauth-protected-resource`).then((res) => res.json());
  if (Array.isArray(metadata.scopes_supported) && metadata.scopes_supported.includes('posts:write')) {
    ok('Metadata RFC 9728 có scopes_supported');
  } else {
    fail('Metadata RFC 9728 có scopes_supported', JSON.stringify(metadata).slice(0, 120));
  }

  // 3) Login admin + tạo token test
  const login = await gql('mutation($i: LoginInput!) { login(input: $i) { accessToken } }', {
    i: { email: ADMIN.email, password: ADMIN.password },
  });
  const adminToken = login.data?.login?.accessToken;
  if (!adminToken) throw new Error(`Không đăng nhập được admin: ${JSON.stringify(login.errors ?? login)}`);

  const suffix = Date.now();
  const created = await gql(
    'mutation($i: CreateAgentTokenInput!) { createAgentToken(input: $i) { token record { id name prefix scopes agentName expiresAt lastUsedAt revokedAt createdAt userEmail userName status } } }',
    {
      i: {
        name: `verify-mcp-${suffix}`,
        agentName: 'verify-mcp',
        scopes: ['posts:read', 'posts:write', 'media:write'],
        expiresInDays: 1,
      },
    },
    adminToken,
  );
  const readWriteToken = created.data?.createAgentToken?.token;
  const readWriteRecord = created.data?.createAgentToken?.record;
  const readWriteId = readWriteRecord?.id;
  if (!readWriteToken) throw new Error(`Không tạo được token: ${JSON.stringify(created.errors ?? created)}`);

  // Trả đủ field cho UI: status (non-null), userEmail, lastUsedAt/revokedAt (nullable)
  if (readWriteRecord?.status === 'ACTIVE' && readWriteRecord?.userEmail) {
    ok('createAgentToken trả đủ field (status, userEmail)');
  } else {
    fail('createAgentToken trả đủ field (status, userEmail)', JSON.stringify(readWriteRecord).slice(0, 200));
  }

  const readOnly = await gql(
    'mutation($i: CreateAgentTokenInput!) { createAgentToken(input: $i) { token record { id } } }',
    { i: { name: `verify-mcp-ro-${suffix}`, scopes: ['posts:read'] } },
    adminToken,
  );
  const readOnlyToken = readOnly.data?.createAgentToken?.token;
  const readOnlyId = readOnly.data?.createAgentToken?.record?.id;

  console.log('\n- Handshake & tools -');

  // 4) initialize
  const init = await mcpRequest(readWriteToken, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name: 'verify-mcp', version: '1.0.0' },
    },
  });
  if (init.status === 200 && init.body?.result?.serverInfo?.name === 'langchaiphuochai-mcp') {
    ok('initialize trả serverInfo');
  } else {
    fail('initialize trả serverInfo', JSON.stringify(init.body).slice(0, 200));
  }
  if (init.body?.result?.instructions?.includes('create_post')) ok('initialize có instructions hướng dẫn');
  else fail('initialize có instructions hướng dẫn', '(thiếu)');

  // 5) tools/list
  const list = await mcpRequest(readWriteToken, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  const toolNames = (list.body?.result?.tools ?? []).map((tool) => tool.name);
  const expected = ['whoami', 'list_categories', 'list_wards', 'search_posts', 'get_post', 'create_post'];
  if (expected.every((name) => toolNames.includes(name))) ok('tools/list đủ 6 tool', toolNames.join(', '));
  else fail('tools/list đủ 6 tool', toolNames.join(', ') || '(rỗng)');

  console.log('\n- Tool đọc dữ liệu -');

  const whoami = await callTool(readWriteToken, 'whoami', {});
  if (!whoami.isError && whoami.data?.token?.scopes?.includes('posts:write')) ok('whoami trả đúng scope');
  else fail('whoami trả đúng scope', JSON.stringify(whoami.data).slice(0, 160));

  const categories = await callTool(readWriteToken, 'list_categories', { section: 'NEWS' });
  const categorySlugs = (categories.data ?? []).map((item) => item.slug);
  if (!categories.isError && categorySlugs.includes('an-uong')) ok('list_categories có danh mục "an-uong"');
  else fail('list_categories có danh mục "an-uong"', categorySlugs.slice(0, 5).join(', '));

  const wards = await callTool(readWriteToken, 'list_wards', { query: 'phuoc hai' });
  if (!wards.isError && (wards.data ?? []).some((ward) => ward.name === 'Xã Phước Hải')) {
    ok('list_wards tìm được "Xã Phước Hải"');
  } else {
    fail('list_wards tìm được "Xã Phước Hải"', JSON.stringify(wards.data).slice(0, 120));
  }

  const searchEmpty = await callTool(readWriteToken, 'search_posts', { keyword: 'verify-mcp-khong-ton-tai' });
  if (!searchEmpty.isError && Array.isArray(searchEmpty.data) && searchEmpty.data.length === 0) {
    ok('search_posts trả mảng rỗng cho từ khoá lạ');
  } else {
    fail('search_posts trả mảng rỗng cho từ khoá lạ', JSON.stringify(searchEmpty.data).slice(0, 120));
  }

  console.log('\n- create_post -');

  const marker = `verify-mcp-${suffix}`;
  const createdPost = await callTool(readWriteToken, 'create_post', {
    type: 'NEWS',
    title: `Kiểm thử MCP tự động ${suffix}`,
    summary: 'Bài do script verify:mcp tạo, sẽ được xoá sau khi kiểm thử.',
    contentMarkdown: `## Tiêu đề phụ\n\nNội dung **kiểm thử** ${marker}.\n\n<script>alert(1)</script>`,
    categorySlug: 'an-uong',
    tags: ['verify-mcp'],
    ward: 'Xã Phước Hải',
    idempotencyKey: marker,
  });
  const postId = createdPost.data?.id;
  const postSlug = createdPost.data?.slug;

  if (!createdPost.isError && postId) ok('create_post tạo bài', postSlug);
  else fail('create_post tạo bài', JSON.stringify(createdPost.data).slice(0, 200));

  if (postId) {
    // Dùng tool get_post để đọc bài DRAFT (query công khai chỉ trả bài đã đăng)
    const detail = await callTool(readWriteToken, 'get_post', { slug: postSlug });
    const post = detail.data;
    if (!detail.isError && post?.status === 'DRAFT') ok('Bài mới ở trạng thái DRAFT');
    else fail('Bài mới ở trạng thái DRAFT', JSON.stringify(post).slice(0, 160));

    if (!detail.isError && !/<script/i.test(post?.contentHtml ?? '')) ok('Nội dung đã sanitize (không còn <script>)');
    else fail('Nội dung đã sanitize (không còn <script>)', 'vẫn còn script');
    if (!detail.isError && post?.ward === 'Xã Phước Hải') ok('Địa chỉ xã/phường được chuẩn hoá');
    else fail('Địa chỉ xã/phường được chuẩn hoá', post?.ward ?? '(trống)');

    // 6) Idempotency: gọi lại cùng key
    const replay = await callTool(readWriteToken, 'create_post', {
      type: 'NEWS',
      title: `Kiểm thử MCP tự động ${suffix}`,
      categorySlug: 'an-uong',
      contentMarkdown: 'Nội dung khác',
      idempotencyKey: marker,
    });
    if (replay.data?.reused === true && replay.data?.id === postId) ok('Idempotency: gọi lại không tạo bài mới');
    else fail('Idempotency: gọi lại không tạo bài mới', JSON.stringify(replay.data).slice(0, 160));

    // 7) Token chỉ đọc không được tạo bài
    const denied = await callTool(readOnlyToken, 'create_post', {
      type: 'NEWS',
      title: 'Bài bị chặn bởi scope',
      categorySlug: 'an-uong',
      contentMarkdown: 'x'.repeat(30),
    });
    if (denied.isError && denied.data?.error?.code === 'FORBIDDEN') ok('Token thiếu posts:write bị chặn (FORBIDDEN)');
    else fail('Token thiếu posts:write bị chặn (FORBIDDEN)', JSON.stringify(denied.data).slice(0, 160));

    // 8) Danh mục và xã/phường sai -> mã lỗi rõ ràng
    const badCategory = await callTool(readWriteToken, 'create_post', {
      type: 'NEWS',
      title: 'Bài danh mục sai',
      categorySlug: 'khong-ton-tai',
      contentMarkdown: 'x'.repeat(30),
    });
    if (badCategory.data?.error?.code === 'INVALID_CATEGORY') ok('Danh mục sai -> INVALID_CATEGORY');
    else fail('Danh mục sai -> INVALID_CATEGORY', JSON.stringify(badCategory.data).slice(0, 160));

    const badWard = await callTool(readWriteToken, 'create_post', {
      type: 'NEWS',
      title: 'Bài xã phường sai',
      categorySlug: 'an-uong',
      ward: 'Quận 1',
      contentMarkdown: 'x'.repeat(30),
    });
    if (badWard.data?.error?.code === 'INVALID_WARD') ok('Xã/phường sai -> INVALID_WARD');
    else fail('Xã/phường sai -> INVALID_WARD', JSON.stringify(badWard.data).slice(0, 160));

    // 9) Bài nằm trong database (query admin, lọc DRAFT)
    const audits = await gql(
      'query($filter: PostFilterInput) { posts(filter: $filter) { total items { id slug status } } }',
      { filter: { keyword: marker, status: 'DRAFT' } },
      adminToken,
    );
    const found = (audits.data?.posts?.items ?? []).some((item) => item.id === postId);
    if (found) ok('Bài kiểm thử có trong database (DRAFT)');
    else fail('Bài kiểm thử có trong database (DRAFT)', JSON.stringify(audits.data?.posts).slice(0, 160));

    // dọn bài kiểm thử
    await gql('mutation($id: String!) { deletePost(id: $id) }', { id: postId }, adminToken);
    const after = await callTool(readWriteToken, 'get_post', { slug: postSlug });
    if (after.isError) ok('Đã xoá bài kiểm thử');
    else fail('Đã xoá bài kiểm thử', 'bài vẫn còn');
  }

  console.log('\n- Dọn dẹp -');
  if (readWriteId) await gql('mutation($id: String!) { revokeAgentToken(id: $id) }', { id: readWriteId }, adminToken);
  if (readOnlyId) await gql('mutation($id: String!) { revokeAgentToken(id: $id) }', { id: readOnlyId }, adminToken);

  const revokedTry = await mcpRequest(readWriteToken, { jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} });
  if (revokedTry.status === 401) ok('Token đã thu hồi bị chặn (401)');
  else fail('Token đã thu hồi bị chặn (401)', `nhận ${revokedTry.status}`);

  console.log(`\n${failed === 0 ? '✅' : '❌'} Kết quả: ${passed} bước đạt / ${passed + failed} bước`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error('Lỗi khi kiểm thử MCP:', error);
  process.exit(1);
});
