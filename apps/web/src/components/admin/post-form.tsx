'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Controller, useFieldArray, useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ImagePlus, Loader2, Save, Send, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { POST_STATUS_LABELS, POST_TYPE_LABELS, PROVINCE_NAME, PostStatus, PostType, UPLOAD, WARDS, buildImageUrl, createPostSchema, type PostInput, slugify } from '@phuochai/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { WardCombobox } from '@/components/ui/ward-combobox';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/auth/auth-context';
import { uploadImage } from '@/lib/uploads';
import {
  useAdminCategoriesQuery,
  useCreatePostMutation,
  useUpdatePostMutation,
  type AdminPostDetailQuery,
} from '@/generated/graphql';

type FormValues = PostInput;

interface PostFormProps {
  /** Bài viết có sẵn khi ở chế độ chỉnh sửa. */
  post?: AdminPostDetailQuery['postById'] | null;
  mode: 'create' | 'edit';
}

/** Form tạo/chỉnh sửa bài viết: react-hook-form + zod dùng chung với backend. */
export function PostForm({ post, mode }: PostFormProps) {
  const router = useRouter();
  const { canPublish, user } = useAuth();
  const { data: categoriesData } = useAdminCategoriesQuery();

  const defaultValues = useMemo<FormValues>(() => {
    if (!post) {
      return {
        type: PostType.ACCOMMODATION,
        status: PostStatus.DRAFT,
        title: '',
        summary: '',
        contentHtml: '',
        tags: [],
        images: [],
        attributes: {},
      } as unknown as FormValues;
    }
    return {
      type: post.type as PostType,
      status: post.status as PostStatus,
      title: post.title,
      slug: post.slug,
      summary: post.summary ?? '',
      contentHtml: post.contentHtml ?? '',
      seoTitle: post.seoTitle ?? '',
      seoDescription: post.seo?.toString() ? (post.summary ?? '') : '',
      categoryId: post.category?.id ?? '',
      tags: post.tags.map((tag) => tag.name),
      addressRaw: post.addressRaw ?? '',
      ward: post.ward ?? '',
      city: PROVINCE_NAME,
      priceRaw: post.priceRaw ?? '',
      priceValue: post.priceValue ?? undefined,
      priceUnit: post.priceUnit ?? 'đ',
      areaM2: post.areaM2 ?? undefined,
      areaText: post.areaText ?? '',
      dimensions: post.dimensions ?? '',
      bedrooms: post.bedrooms ?? undefined,
      bathrooms: post.bathrooms ?? undefined,
      floors: post.floors ?? undefined,
      direction: post.direction ?? '',
      roadWidth: post.roadWidth ?? '',
      legal: post.legal ?? '',
      contactName: post.contactName ?? '',
      contactPhone: post.contactPhone ?? '',
      contactEmail: post.contactEmail ?? '',
      contactZalo: post.contactZalo ?? '',
      verified: post.verified ?? false,
      hasManager: post.hasManager ?? false,
      images: post.images.map((image, index) => ({
        path: image.path,
        role: (image.role as 'hero' | 'gallery' | 'content' | 'category' | 'other') ?? 'gallery',
        alt: image.alt ?? '',
        sortOrder: index,
      })),
      attributes: (post.attributes as Record<string, string>) ?? {},
    } as unknown as FormValues;
  }, [post]);

  const form = useForm<FormValues>({
    // zod schema có transform (chuỗi -> số, '' -> undefined) nên cần ép kiểu resolver.
    resolver: zodResolver(createPostSchema) as unknown as Resolver<FormValues>,
    defaultValues,
    mode: 'onBlur',
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  const { fields, append, remove } = useFieldArray({ control, name: 'images' });

  // Upload ảnh: file được gửi tới API mới và lưu trong thư mục upload/ của máy chủ
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let uploaded = 0;
    try {
      for (const file of Array.from(files)) {
        const result = await uploadImage(file, UPLOAD.postsFolder);
        append(
          {
            path: result.path,
            role: fields.length + uploaded === 0 ? 'hero' : 'gallery',
            alt: file.name.replace(/\.[^.]+$/, ''),
            sortOrder: fields.length + uploaded,
          },
          { shouldFocus: false },
        );
        uploaded += 1;
      }
      toast.success(`Đã tải lên ${uploaded} ảnh`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không tải được ảnh');
    } finally {
      setUploading(false);
    }
  };

  const [createPost] = useCreatePostMutation();
  const [updatePost] = useUpdatePostMutation();

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const selectedType = watch('type');
  const title = watch('title');
  const categories = (categoriesData?.categories ?? []).filter(
    (category) => category.section === selectedType && !category.isLocationFilter,
  );

  const onSubmit = handleSubmit(async (values) => {
    // `values` đã được zod transform (chuỗi rỗng -> undefined, số dạng chuỗi -> number).
    const input = values as unknown as PostInput;
    try {
      if (mode === 'create') {
        const result = await createPost({ variables: { input } });
        toast.success('Đã tạo bài viết');
        router.push(`/quan-tri/bai-viet/${result.data?.createPost.id}`);
      } else if (post) {
        await updatePost({ variables: { input: { ...input, id: post.id } } });
        toast.success('Đã lưu thay đổi');
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không lưu được bài viết');
    }
  });

  const submitWithStatus = (status: PostStatus) => {
    setValue('status', status, { shouldDirty: true });
    void onSubmit();
  };

  const isOwner = !post || post.author?.id === user?.id;
  const readOnly = !canPublish && !isOwner;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" asChild>
            <Link href="/quan-tri/bai-viet" aria-label="Quay lại danh sách">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="font-display text-xl font-bold">
              {mode === 'create' ? 'Thêm bài viết mới' : 'Chỉnh sửa bài viết'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {post ? `Cập nhật lần cuối: ${new Date(post.updatedAt).toLocaleString('vi-VN')}` : 'Điền thông tin và lưu bài viết'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {readOnly ? <span className="text-xs text-muted-foreground">Bạn chỉ có quyền xem bài viết này</span> : null}
          <Button type="submit" variant="outline" disabled={isSubmitting || readOnly}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Lưu
          </Button>
          {canPublish ? (
            <Button
              type="button"
              disabled={isSubmitting || readOnly}
              onClick={() => submitWithStatus(PostStatus.PUBLISHED)}
            >
              <Send className="mr-2 h-4 w-4" /> Xuất bản
            </Button>
          ) : (
            <Button type="button" variant="secondary" disabled={isSubmitting} onClick={() => submitWithStatus(PostStatus.DRAFT)}>
              Gửi bản nháp
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* Cột chính */}
        <div className="space-y-5">
          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base">Nội dung chính</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Tiêu đề *</Label>
                <Input id="title" placeholder="VD: Homestay view biển Phước Hải" {...register('title')} />
                {errors.title ? <p className="text-xs text-destructive">{errors.title.message}</p> : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug (để trống sẽ tự sinh)</Label>
                  <Input
                    id="slug"
                    placeholder={slugify(title || 'duong-dan-bai-viet')}
                    {...register('slug')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Trạng thái</Label>
                  <Select
                    value={watch('status') ?? PostStatus.DRAFT}
                    onValueChange={(value) => setValue('status', value as PostStatus, { shouldDirty: true })}
                    disabled={!canPublish}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(POST_STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value} disabled={value === PostStatus.PUBLISHED && !canPublish}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="summary">Mô tả ngắn</Label>
                <Textarea
                  id="summary"
                  rows={3}
                  placeholder="Tóm tắt 2-3 dòng hiển thị ở danh sách và kết quả tìm kiếm"
                  {...register('summary')}
                />
              </div>

              <div className="space-y-2">
                <Label>Nội dung bài viết</Label>
                <Controller
                  control={control}
                  name="contentHtml"
                  render={({ field }) => (
                    <RichTextEditor
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      placeholder="Nhập nội dung bài viết, hoặc bấm nút ảnh để chèn hình..."
                    />
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  Soạn thảo trực quan như Word: chọn chữ để in đậm/nghiêng, chèn ảnh, bảng, danh sách, liên kết.
                  Cần sửa mã HTML? Bấm <strong>Chế độ HTML</strong> ở góc phải thanh công cụ.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base">Thông tin chi tiết</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="location">
                <TabsList className="mb-4">
                  <TabsTrigger value="location">Địa điểm</TabsTrigger>
                  <TabsTrigger value="price">Giá &amp; diện tích</TabsTrigger>
                  <TabsTrigger value="contact">Liên hệ</TabsTrigger>
                  <TabsTrigger value="seo">SEO</TabsTrigger>
                </TabsList>

                <TabsContent value="location" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="addressRaw">Địa chỉ chi tiết</Label>
                    <Input
                      id="addressRaw"
                      placeholder="Số nhà, đường, khu phố (không cần xã/phường, tỉnh/thành)"
                      {...register('addressRaw')}
                    />
                    <p className="text-xs text-muted-foreground">
                      Chỉ nhập phần chi tiết - xã/phường và tỉnh/thành được chọn ở dưới.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="ward">Xã / phường</Label>
                      <Controller
                        control={control}
                        name="ward"
                        render={({ field }) => (
                          <WardCombobox id="ward" value={field.value ?? ''} onChange={(ward) => field.onChange(ward ?? '')} />
                        )}
                      />
                      <p className="text-xs text-muted-foreground">
                        Danh mục {WARDS.length} xã/phường/đặc khu của TP. Hồ Chí Minh (đã bỏ cấp quận/huyện).
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="city">Tỉnh / thành phố</Label>
                      <Input id="city" value={PROVINCE_NAME} readOnly disabled className="bg-muted/50" />
                      <p className="text-xs text-muted-foreground">Website chỉ hỗ trợ TP. Hồ Chí Minh.</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="price" className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="priceRaw">Giá (chuỗi hiển thị)</Label>
                      <Input id="priceRaw" placeholder="1.000.000 hoặc 17 tỷ" {...register('priceRaw')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priceValue">Giá (VND)</Label>
                      <Input id="priceValue" type="number" inputMode="numeric" {...register('priceValue')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priceUnit">Đơn vị</Label>
                      <Input id="priceUnit" placeholder="đ / tỷ" {...register('priceUnit')} />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="areaText">Diện tích (hiển thị)</Label>
                      <Input id="areaText" placeholder="250m²" {...register('areaText')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="areaM2">Diện tích (m²)</Label>
                      <Input id="areaM2" type="number" {...register('areaM2')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dimensions">Ngang x dài</Label>
                      <Input id="dimensions" placeholder="10 x 15 m" {...register('dimensions')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bedrooms">Phòng ngủ</Label>
                      <Input id="bedrooms" type="number" {...register('bedrooms')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bathrooms">WC</Label>
                      <Input id="bathrooms" type="number" {...register('bathrooms')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="floors">Số tầng</Label>
                      <Input id="floors" type="number" {...register('floors')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="direction">Hướng</Label>
                      <Input id="direction" placeholder="Đông bắc" {...register('direction')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="roadWidth">Đường trước nhà</Label>
                      <Input id="roadWidth" placeholder="12 m" {...register('roadWidth')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="legal">Pháp lý</Label>
                      <Input id="legal" placeholder="Sổ hồng" {...register('legal')} />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="contact" className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="contactName">Tên người liên hệ</Label>
                      <Input id="contactName" {...register('contactName')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactPhone">Điện thoại</Label>
                      <Input id="contactPhone" {...register('contactPhone')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactEmail">Email</Label>
                      <Input id="contactEmail" type="email" {...register('contactEmail')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactZalo">Zalo</Label>
                      <Input id="contactZalo" {...register('contactZalo')} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-6">
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={!!watch('verified')}
                        onCheckedChange={(checked) => setValue('verified', checked, { shouldDirty: true })}
                      />
                      Đã xác thực thông tin
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={!!watch('hasManager')}
                        onCheckedChange={(checked) => setValue('hasManager', checked, { shouldDirty: true })}
                      />
                      Đã có người quản lý
                    </label>
                  </div>
                </TabsContent>

                <TabsContent value="seo" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="seoTitle">Tiêu đề SEO</Label>
                    <Input id="seoTitle" {...register('seoTitle')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="seoDescription">Mô tả SEO</Label>
                    <Textarea id="seoDescription" rows={3} {...register('seoDescription')} />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="font-display text-base">Thư viện ảnh</CardTitle>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={UPLOAD.allowedMimeTypes.join(',')}
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    void handleUpload(event.target.files);
                    event.target.value = '';
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {uploading ? 'Đang tải ảnh...' : 'Tải ảnh lên'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => append({ path: '', role: 'gallery', alt: '', sortOrder: fields.length })}
                >
                  <ImagePlus className="mr-2 h-4 w-4" /> Thêm bằng đường dẫn
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Ảnh được lưu trong thư mục <code className="rounded bg-muted px-1">upload/</code> của máy chủ
                (tối đa {(UPLOAD.maxBytes / 1024 / 1024).toFixed(0)}MB mỗi ảnh, định dạng JPG, PNG, WEBP, GIF, AVIF).
                Ảnh đầu tiên nên đặt vai trò “Ảnh đại diện”.
              </p>

              {fields.length === 0 ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground transition hover:border-primary hover:text-primary"
                >
                  <Upload className="h-5 w-5" />
                  Bấm để chọn ảnh từ máy của bạn
                </button>
              ) : null}

              {fields.map((field, index) => (
                <div key={field.id} className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3">
                  <div className="h-16 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
                    {watch(`images.${index}.path`) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={buildImageUrl({ path: watch(`images.${index}.path`) })}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-[240px] flex-1 space-y-1">
                    <Label className="text-xs">Đường dẫn ảnh trên máy chủ</Label>
                    <Input
                      className="text-xs"
                      placeholder="/upload/posts/2026/10/anh.jpg"
                      {...register(`images.${index}.path` as const)}
                    />
                  </div>
                  <div className="w-[150px] space-y-1">
                    <Label className="text-xs">Vai trò</Label>
                    <Select
                      value={watch(`images.${index}.role`) ?? 'gallery'}
                      onValueChange={(value) =>
                        setValue(`images.${index}.role`, value as 'hero' | 'gallery' | 'content', { shouldDirty: true })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hero">Ảnh đại diện</SelectItem>
                        <SelectItem value="gallery">Thư viện</SelectItem>
                        <SelectItem value="content">Trong bài</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-[180px] space-y-1">
                    <Label className="text-xs">Mô tả ảnh (alt)</Label>
                    <Input className="text-xs" {...register(`images.${index}.alt` as const)} />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    aria-label="Xoá ảnh"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Cột phụ */}
        <div className="space-y-5">
          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base">Phân loại</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Loại nội dung *</Label>
                <Select
                  value={selectedType}
                  onValueChange={(value) => {
                    setValue('type', value as PostType, { shouldDirty: true });
                    setValue('categoryId', '', { shouldDirty: true });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(POST_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Danh mục</Label>
                <Select
                  value={watch('categoryId') || 'none'}
                  onValueChange={(value) => setValue('categoryId', value === 'none' ? '' : value, { shouldDirty: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn danh mục" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Không chọn</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.parentId ? '- ' : ''}
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags (phân cách bằng dấu phẩy)</Label>
                <Input
                  id="tags"
                  defaultValue={post?.tags.map((tag) => tag.name).join(', ') ?? ''}
                  onChange={(event) =>
                    setValue(
                      'tags',
                      event.target.value
                        .split(',')
                        .map((tag) => tag.trim())
                        .filter(Boolean),
                      { shouldDirty: true },
                    )
                  }
                  placeholder="homestay, view biển, Phước Hải"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base">Thông tin hệ thống</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Trạng thái</span>
                <span className="font-medium">
                  {POST_STATUS_LABELS[(watch('status') ?? PostStatus.DRAFT) as PostStatus]}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Người đăng</span>
                <span className="font-medium">{post?.author?.name ?? user?.name ?? '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Lượt xem</span>
                <span className="font-medium">{post?.views ?? 0}</span>
              </div>
              {post?.sourceKey ? (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Khoá gốc</span>
                  <span className="font-mono text-xs">{post.sourceKey}</span>
                </div>
              ) : null}
              {isDirty ? (
                <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                  Có thay đổi chưa lưu
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
