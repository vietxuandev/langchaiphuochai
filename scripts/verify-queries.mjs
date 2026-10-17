/**
 * Đối chiếu các con số thống kê trả về từ API với dữ liệu thật.
 *
 * Vì sao cần: đã gặp lỗi `postCount` của danh mục con luôn bằng 0 (do service hardcode),
 * khiến trang /danh-muc/... hiển thị "Homestay (0)", "Villa (0)"... dù có hàng chục bài.
 *
 * Nguyên tắc kiểm tra: **số đếm phải bằng số bài thật khi lọc** - nếu lệch là báo lỗi.
 *
 * Chạy: npm run verify:queries   (cần API đang chạy)
 */
const GRAPHQL = process.env.API_URL ?? 'http://localhost:4000/graphql';
const ADMIN = { email: 'admin@langchaiphuochai.com', password: 'Admin@123' };

let failed = 0;

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

function assert(label, condition, detail = '') {
  if (condition) console.log(`✅ ${label}`);
  else {
    console.log(`❌ ${label}${detail ? ` - ${detail}` : ''}`);
    failed += 1;
  }
}

async function main() {
  const login = await gql(
    'mutation($input: LoginInput!) { login(input: $input) { accessToken } }',
    { input: ADMIN },
  );
  const token = login.data?.login?.accessToken;
  if (!token) {
    console.log('❌ Không đăng nhập được - hãy chắc chắn API đang chạy.');
    process.exit(1);
  }

  /* ---------------------- 1. postCount của danh mục ---------------------- */
  console.log('=== 1. Số bài theo danh mục (postCount) ===');
  const categories = (await gql('{ categories { id name slug section level postCount } }', undefined, token)).data
    .categories;

  const nonZero = categories.filter((category) => category.postCount > 0);
  assert(
    'Có danh mục với postCount > 0',
    nonZero.length > 0,
    `tất cả ${categories.length} danh mục đều 0`,
  );

  // Danh mục cha phải bằng tổng danh mục con
  const parents = categories.filter((category) => category.level === 0);
  for (const parent of parents) {
    const children = categories.filter((category) => category.slug !== parent.slug && category.section === parent.section && category.level === 1);
    if (children.length === 0) continue;
    const sum = children.reduce((total, child) => total + child.postCount, 0);
    assert(
      `"${parent.name}": postCount (${parent.postCount}) = tổng danh mục con (${sum})`,
      parent.postCount === sum,
    );
  }

  /* ------------------ 2. postCount khớp với số bài thật ------------------- */
  console.log('\n=== 2. so với số bài khi lọc thật ===');
  const samples = [
    ...parents.slice(0, 1),
    ...categories.filter((category) => category.level === 1).slice(0, 4),
  ];

  for (const category of samples) {
    const result = await gql(
      'query($filter: PostFilterInput) { posts(filter: $filter) { total } }',
      { filter: { categorySlug: category.slug, status: 'PUBLISHED', pageSize: 1 } },
      token,
    );
    const total = result.data?.posts?.total ?? -1;
    assert(
      `"${category.name}": postCount ${category.postCount} = posts.total ${total}`,
      total === category.postCount,
    );
  }

  /* ------- 3. category(slug) trả cùng số với danh sách categories -------- */
  console.log('\n=== 3. quyền chi tiết danh mục ===');
  const parentSlug = parents[0]?.slug;
  if (parentSlug) {
    const detail = (await gql(
      'query($slug: String!) { category(slug: $slug) { name postCount children { name postCount } } }',
      { slug: parentSlug },
      token,
    )).data.category;

    const childSum = detail.children.reduce((total, child) => total + child.postCount, 0);
    assert(`category("${parentSlug}") postCount khớp tổng children`, detail.postCount === childSum, `${detail.postCount} vs ${childSum}`);
    assert(
      'Mọi danh mục con trong trang danh mục đều có số bài > 0',
      detail.children.every((child) => child.postCount > 0),
      detail.children.filter((child) => child.postCount === 0).map((child) => child.name).join(', '),
    );
  }

  /* ------------- 3b. bấm vào tag phải thấy chính bài viết đó ---------------- */
  console.log('\n=== 3b. tìm kiếm theo tag (link tag trên bài viết) ===');
  const postsWithTags = await gql(
    `query {
       posts(filter: { status: PUBLISHED, pageSize: 60 }) {
         items { slug title tags { name } }
       }
     }`,
    undefined,
    token,
  );
  const items = (postsWithTags.data?.posts?.items ?? []).filter((post) => post.tags.length > 0);
  assert('Có bài viết kèm tag để kiểm tra', items.length > 0);

  let missing = 0;
  let checked = 0;
  for (const post of items) {
    for (const tag of post.tags.slice(0, 2)) {
      checked += 1;
      const result = await gql(
        'query($filter: PostFilterInput) { posts(filter: $filter) { items { slug } } }',
        { filter: { keyword: tag.name, status: 'PUBLISHED', pageSize: 50 } },
        token,
      );
      const slugs = (result.data?.posts?.items ?? []).map((item) => item.slug);
      if (!slugs.includes(post.slug)) {
        missing += 1;
        console.log(`   thiếu: tag "${tag.name}" không trả về bài "${post.title.slice(0, 40)}"`);
      }
    }
  }
  assert(
    `Bấm tag luôn thấy bài viết chứa tag đó (${checked} lượt kiểm tra)`,
    missing === 0,
    `${missing} lượt không thấy bài`,
  );

  /* ------------------ 4. thống kê công khai khớp dữ liệu ----------------- */
  console.log('\n=== 4. thống kê công khai ===');
  const publishedTotal = (await gql(
    'query { posts(filter: { status: PUBLISHED, pageSize: 1 }) { total } }',
    undefined,
    token,
  )).data.posts.total;
  const publicStats = (await gql('{ publicStats { totalPosts accommodations } }')).data.publicStats;

  assert(
    `publicStats.totalPosts (${publicStats.totalPosts}) = số bài đã xuất bản (${publishedTotal})`,
    publicStats.totalPosts === publishedTotal,
  );
  assert('publicStats.accommodations > 0', publicStats.accommodations > 0);

  console.log('');
  if (failed > 0) {
    console.log(`❌ ${failed} kiểm tra thất bại.`);
    process.exit(1);
  }
  console.log('✅ Các con số thống kê khớp với dữ liệu thật.');
}

main().catch((error) => {
  console.error('Lỗi kiểm tra thống kê:', error);
  process.exit(1);
});
