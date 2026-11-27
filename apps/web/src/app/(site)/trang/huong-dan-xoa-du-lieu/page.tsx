import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hướng dẫn xoá dữ liệu',
  description: 'Cách yêu cầu xoá dữ liệu cá nhân liên quan đến Làng Chài Phước Hải.',
  alternates: { canonical: '/trang/huong-dan-xoa-du-lieu' },
};

const CONTACT_EMAIL = 'vietxuandev@gmail.com';

/** Trang hướng dẫn xoá dữ liệu người dùng (Meta yêu cầu URL này cho ứng dụng Facebook). */
export default function DataDeletionPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-2xl font-bold md:text-3xl">Hướng dẫn xoá dữ liệu</h1>
      <div className="mt-6 space-y-4 leading-relaxed text-muted-foreground">
        <p>
          Làng Chài Phước Hải chỉ lưu lượng dữ liệu tối thiểu. Ứng dụng Facebook của chúng tôi chỉ dùng để đăng bài viết
          của website lên Trang Facebook của chính chúng tôi và không thu thập dữ liệu cá nhân của người dùng Facebook.
        </p>
        <h2 className="font-display text-xl font-semibold text-foreground">Cách yêu cầu xoá dữ liệu</h2>
        <ol className="list-decimal space-y-2 pl-6">
          <li>
            Gửi email tới{' '}
            <a className="text-primary underline" href={`mailto:${CONTACT_EMAIL}?subject=Yêu cầu xoá dữ liệu`}>
              {CONTACT_EMAIL}
            </a>{' '}
            với tiêu đề &quot;Yêu cầu xoá dữ liệu&quot;.
          </li>
          <li>Nêu rõ email hoặc tên tài khoản (trên website hoặc Facebook) cần xoá và loại dữ liệu muốn xoá.</li>
          <li>Chúng tôi xác minh yêu cầu và xoá dữ liệu trong vòng 7 ngày làm việc, sau đó phản hồi qua email.</li>
        </ol>
        <p>
          Nếu bạn đã cấp quyền cho ứng dụng của chúng tôi trên Facebook, bạn cũng có thể gỡ ứng dụng tại Cài đặt Facebook
          &gt; Ứng dụng và trang web.
        </p>
      </div>
    </div>
  );
}
