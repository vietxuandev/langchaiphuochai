import Image from 'next/image';
import { ArrowDownRight, MapPin, MapPinned, Search, Waves } from 'lucide-react';
import { WARD_NAMES } from '@phuochai/shared';
import heroImage from '@/assets/phuoc-hai-hero.jpg';

/**
 * Hero trang chủ - chuyển từ project `dulichphuochai`.
 *
 * Giữ nguyên tinh thần: ảnh biển full-bleed, overlay tối, tiêu đề serif lớn
 * và thanh tìm kiếm nổi. Thanh tìm kiếm được nối với `/tim-kiem` hiện có:
 *   - `q`        : từ khoá (tên homestay, quán ăn, bãi tắm...)
 *   - `xa-phuong`: xã/phường, dùng datalist để gợi ý đúng tên chuẩn
 */
export function HomeHero() {
  return (
    <section className="relative flex h-[92svh] min-h-[680px] items-center overflow-hidden bg-[#123d45] text-white">
      {/* Ảnh nền + lớp phủ giúp chữ luôn đọc được trên vùng ảnh sáng */}
      <Image
        src={heroImage}
        alt="Bờ biển Phước Hải trong ánh nắng sớm"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(5,34,39,.82) 0%, rgba(5,34,39,.46) 48%, rgba(5,34,39,.18) 100%)',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#082f35]/80 via-transparent to-black/20" />

      <div className="container relative z-10 pb-24 pt-16 md:pt-20">
        <div className="max-w-4xl">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-white backdrop-blur-md">
            <Waves className="h-4 w-4 text-[#8de0d4]" /> Làng chài trăm năm tuổi
          </span>

          <h1 className="max-w-4xl font-editorial text-[clamp(3.2rem,7.5vw,6.8rem)] font-medium leading-[0.9] text-white">
            <span className="sr-only">Danh bạ lưu trú và du lịch Phước Hải: </span>
            Chạm vào nhịp sống
            <span className="block italic text-[#a7e6da]">của biển.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/75 md:text-xl">
            Một Phước Hải nguyên bản — nơi bình minh lên cùng thuyền cá, bữa ăn mang vị mặn của
            biển và mỗi chuyến đi đều có câu chuyện để nhớ.
          </p>

          {/* Thanh tìm kiếm: gửi GET tới /tim-kiem, đúng các tham số trang tìm kiếm đang đọc */}
          <form
            action="/tim-kiem"
            method="get"
            role="search"
            aria-label="Tìm kiếm địa điểm tại Phước Hải"
            className="mt-9 flex w-full max-w-3xl flex-col items-stretch gap-1 rounded-[1.5rem] bg-[#fffdf8] p-2 shadow-2xl shadow-black/20 md:flex-row md:items-center md:rounded-full"
          >
            <div className="flex w-full flex-1 items-center px-4 py-3 md:border-r md:border-slate-200 md:py-0">
              <MapPin className="mr-3 h-5 w-5 flex-shrink-0 text-[#0b6973]" />
              <input
                type="search"
                name="q"
                placeholder="Bạn muốn tìm gì?"
                aria-label="Từ khoá: tên homestay, quán ăn, bãi tắm..."
                className="w-full border-none bg-transparent text-sm text-[#173c42] placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            <div className="flex w-full flex-1 items-center border-t border-slate-100 px-4 py-3 md:border-t-0 md:py-0">
              <MapPinned className="mr-3 h-5 w-5 flex-shrink-0 text-[#0b6973]" />
              <input
                type="text"
                name="xa-phuong"
                list="hero-ward-options"
                autoComplete="off"
                placeholder="Xã / phường"
                aria-label="Chọn xã hoặc phường"
                className="w-full border-none bg-transparent text-sm text-[#173c42] placeholder:text-slate-400 focus:outline-none"
              />
              <datalist id="hero-ward-options">
                {WARD_NAMES.map((ward) => (
                  <option key={ward} value={ward} />
                ))}
              </datalist>
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-center rounded-2xl bg-[#e76f51] px-7 py-4 font-bold text-white shadow-lg shadow-[#e76f51]/20 transition-all hover:bg-[#d75f43] md:w-auto md:rounded-full"
            >
              Tìm kiếm <Search className="ml-2 h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      <a
        href="#kham-pha"
        className="absolute bottom-9 right-6 z-10 hidden items-center gap-3 text-xs uppercase tracking-[0.2em] text-white/70 transition hover:text-white md:right-12 md:flex"
      >
        Cuộn để khám phá <ArrowDownRight className="h-5 w-5" />
      </a>
    </section>
  );
}
