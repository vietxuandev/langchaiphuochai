'use client';

import { useEffect, useState } from 'react';
import {
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  MousePointerClick,
  Pencil,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Role, formatDateTime } from '@phuochai/shared';
import { AffiliateClicksChart } from '@/components/admin/dashboard-charts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth/auth-context';
import {
  createAffiliateLink,
  deleteAffiliateLink,
  fetchAffiliateLinks,
  fetchAffiliateMetadata,
  fetchAffiliateStats,
  updateAffiliateLink,
  type AffiliateLink,
  type AffiliateLinkInput,
  type AffiliateList,
  type AffiliateStats,
} from '@/lib/affiliate';

type FormState = {
  title: string;
  slug: string;
  destinationUrl: string;
  description: string;
  imagePath: string;
  priceText: string;
  campaign: string;
  subId: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  title: '',
  slug: '',
  destinationUrl: '',
  description: '',
  imagePath: '',
  priceText: '',
  campaign: '',
  subId: '',
  isActive: true,
};

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function destinationHost(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return value;
  }
}

export function AffiliateManager() {
  const { hasRole } = useAuth();
  const canManage = hasRole(Role.EDITOR);
  const [data, setData] = useState<AffiliateList | null>(null);
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState('all');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AffiliateLink | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [metadataMessage, setMetadataMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AffiliateLink | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!canManage) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAffiliateLinks({
      query,
      active: active === 'all' ? undefined : active === 'true',
      page,
      pageSize: 20,
    })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Không tải được affiliate');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canManage, query, active, page, refresh]);

  useEffect(() => {
    if (!canManage) return;
    let cancelled = false;
    fetchAffiliateStats()
      .then((result) => {
        if (!cancelled) setStats(result);
      })
      .catch(() => {
        // Lỗi stats không chặn danh sách link.
      });
    return () => {
      cancelled = true;
    };
  }, [canManage, refresh]);

  if (!canManage) {
    return (
      <div className="rounded-xl border border-border bg-background p-8 text-center">
        <p className="font-medium">Bạn không có quyền quản lý affiliate.</p>
        <p className="mt-1 text-sm text-muted-foreground">Cần vai trò Biên tập viên trở lên.</p>
      </div>
    );
  }

  const items = data?.items ?? [];

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setMetadataMessage(null);
    setDialogOpen(true);
  };

  const openEdit = (link: AffiliateLink) => {
    setEditing(link);
    setForm({
      title: link.title,
      slug: link.slug,
      destinationUrl: link.destinationUrl,
      description: link.description ?? '',
      imagePath: link.imagePath ?? '',
      priceText: link.priceText ?? '',
      campaign: link.campaign ?? '',
      subId: link.subId ?? '',
      isActive: link.isActive,
    });
    setFormError(null);
    setMetadataMessage(null);
    setDialogOpen(true);
  };

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleCopy = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/go/${slug}`);
      toast.success('Đã copy link /go/' + slug);
    } catch {
      toast.error('Trình duyệt không cho phép copy');
    }
  };

  const handleToggle = async (link: AffiliateLink) => {
    try {
      await updateAffiliateLink(link.id, { isActive: !link.isActive });
      toast.success(link.isActive ? 'Đã tắt link' : 'Đã bật link');
      setRefresh((value) => value + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không đổi được trạng thái');
    }
  };

  const handleFetchMetadata = async () => {
    const url = form.destinationUrl.trim();
    if (!url) {
      toast.error('Dán link Shopee trước');
      return;
    }
    setFetchingMeta(true);
    setMetadataMessage(null);
    try {
      const result = await fetchAffiliateMetadata(url);
      if (result.ok) {
        setForm((current) => ({
          ...current,
          title: result.title || current.title,
          description: result.description || current.description,
          imagePath: result.imagePath || current.imagePath,
          priceText: result.priceText || current.priceText,
          slug: current.slug || slugify(result.title || ''),
        }));
        setMetadataMessage(
          result.source === 'openapi'
            ? 'Đã lấy dữ liệu từ Shopee Open API.'
            : 'Đã lấy metadata từ trang Shopee.',
        );
        toast.success('Đã điền metadata từ link');
      } else {
        const message = result.message ?? 'Shopee không trả metadata cho link này.';
        setMetadataMessage(message);
        toast.warning(message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không lấy được metadata';
      setMetadataMessage(message);
      toast.error(message);
    } finally {
      setFetchingMeta(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    const input: AffiliateLinkInput = {
      title: form.title,
      slug: form.slug,
      destinationUrl: form.destinationUrl,
      description: form.description || undefined,
      imagePath: form.imagePath || undefined,
      priceText: form.priceText || undefined,
      campaign: form.campaign || undefined,
      subId: form.subId || undefined,
      isActive: form.isActive,
    };
    try {
      if (editing) {
        await updateAffiliateLink(editing.id, input);
        toast.success('Đã cập nhật link affiliate');
      } else {
        await createAffiliateLink(input);
        toast.success('Đã tạo link affiliate');
      }
      setDialogOpen(false);
      setRefresh((value) => value + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không lưu được link affiliate');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteAffiliateLink(deleting.id);
      toast.success('Đã xoá link affiliate');
      setDeleting(null);
      setRefresh((value) => value + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không xoá được link');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Affiliate Shopee</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý link, theo dõi click và chèn thẻ sản phẩm vào bài viết.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Thêm link
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Tổng link" value={stats?.totalLinks ?? 0} icon={Link2} hint={`${stats?.activeLinks ?? 0} đang bật`} />
        <StatCard title="Tổng click" value={stats?.totalClicks ?? 0} icon={MousePointerClick} hint={`${stats?.clicksToday ?? 0} hôm nay`} />
        <StatCard title="Click 7 ngày" value={stats?.clicks7d ?? 0} icon={ShoppingBag} hint="Từ link /go" />
        <StatCard title="Link chưa có click" value={stats?.noClickLinks ?? 0} icon={ExternalLink} hint="Cần kiểm tra nội dung/vị trí" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_.85fr_.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Click 7 ngày gần nhất</CardTitle>
          </CardHeader>
          <CardContent>
            <AffiliateClicksChart data={stats?.clickTrend ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Top link</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(stats?.topLinks ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có click.</p>
            ) : (
              stats?.topLinks.map((link) => (
                <div key={link.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{link.title}</span>
                  <Badge variant="muted" className="shrink-0 tabular-nums">{link.clicks} click</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Click gần đây</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(stats?.recentClicks ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có click.</p>
            ) : (
              stats?.recentClicks.slice(0, 5).map((click) => (
                <div key={click.id} className="border-b border-border/60 pb-2 text-xs last:border-0 last:pb-0">
                  <p className="truncate font-medium">{click.link.title}</p>
                  <p className="mt-0.5 text-muted-foreground">
                    {click.postSlug ? `từ ${click.postSlug} · ` : ''}
                    {formatDateTime(click.createdAt)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {(stats?.health.inactive || stats?.health.noClicks || stats?.health.missingImage) ? (
        <div className="flex flex-wrap gap-2 text-sm">
          {stats?.health.inactive ? <Badge variant="warning">{stats.health.inactive} link đang tắt</Badge> : null}
          {stats?.health.noClicks ? <Badge variant="muted">{stats.health.noClicks} link chưa click</Badge> : null}
          {stats?.health.missingImage ? <Badge variant="muted">{stats.health.missingImage} link thiếu ảnh</Badge> : null}
        </div>
      ) : null}

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo tiêu đề, slug, chiến dịch..."
              className="pl-9"
            />
          </div>
          <Select
            value={active}
            onValueChange={(value) => {
              setActive(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-44" aria-label="Lọc trạng thái">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả trạng thái</SelectItem>
              <SelectItem value="true">Đang bật</SelectItem>
              <SelectItem value="false">Đang tắt</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-14 rounded-lg" />)}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="font-medium text-destructive">{error}</p>
            <Button variant="outline" className="mt-3" onClick={() => setRefresh((value) => value + 1)}>Thử lại</Button>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="Chưa có link affiliate"
          description="Tạo link đầu tiên để dùng trong bài viết."
          action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Thêm link</Button>}
        />
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Link</TableHead>
                    <TableHead className="hidden md:table-cell">Đích</TableHead>
                    <TableHead className="hidden lg:table-cell">Chiến dịch</TableHead>
                    <TableHead className="text-right">Click</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="w-32" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell className="max-w-[340px]">
                        <p className="truncate font-medium">{link.title}</p>
                        <p className="truncate text-xs text-muted-foreground">/go/{link.slug}</p>
                        {link.priceText ? <p className="mt-0.5 text-xs text-sea-700">{link.priceText}</p> : null}
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                        {destinationHost(link.destinationUrl)}
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                        {link.campaign ?? '-'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{link.clicks}</TableCell>
                      <TableCell>
                        <Switch checked={link.isActive} onCheckedChange={() => void handleToggle(link)} aria-label="Bật/tắt link" />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Copy link" onClick={() => void handleCopy(link.slug)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Sửa" onClick={() => openEdit(link)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Xoá" className="text-destructive hover:text-destructive" onClick={() => setDeleting(link)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Pagination page={data?.page ?? 1} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Sửa link affiliate' : 'Thêm link affiliate'}</DialogTitle>
            <DialogDescription>
              Link sẽ được dùng qua đường dẫn <code>/go/&lt;slug&gt;</code>; không dán trực tiếp link Shopee vào bài.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="affiliate-title">Tiêu đề</Label>
                <Input id="affiliate-title" value={form.title} onChange={(event) => updateField('title', event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="affiliate-slug">Slug</Label>
                <Input id="affiliate-slug" value={form.slug} onChange={(event) => updateField('slug', event.target.value)} placeholder="tui-chong-nang" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="affiliate-price">Giá tham khảo</Label>
                <Input id="affiliate-price" value={form.priceText} onChange={(event) => updateField('priceText', event.target.value)} placeholder="Ví dụ: 150.000đ" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="affiliate-url">URL đích Shopee</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input id="affiliate-url" value={form.destinationUrl} onChange={(event) => updateField('destinationUrl', event.target.value)} placeholder="https://s.shopee.vn/..." required />
                  <Button type="button" variant="outline" className="shrink-0" onClick={() => void handleFetchMetadata()} disabled={fetchingMeta}>
                    {fetchingMeta ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Lấy thông tin từ link
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ưu tiên link affiliate dạng <code>s.shopee.vn/...</code>. Shopee có thể chặn đọc HTML; khi đó cần cấu hình <code>SHOPEE_AFFILIATE_ACCESS_TOKEN</code> cho Open API hoặc nhập tay.
                </p>
                {metadataMessage ? (
                  <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">{metadataMessage}</p>
                ) : null}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="affiliate-description">Mô tả ngắn</Label>
                <Textarea id="affiliate-description" rows={2} value={form.description} onChange={(event) => updateField('description', event.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="affiliate-image">Ảnh sản phẩm</Label>
                <Input id="affiliate-image" value={form.imagePath} onChange={(event) => updateField('imagePath', event.target.value)} placeholder="/upload/posts/... hoặc https://..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="affiliate-campaign">Chiến dịch</Label>
                <Input id="affiliate-campaign" value={form.campaign} onChange={(event) => updateField('campaign', event.target.value)} placeholder="Ví dụ: do-di-bien" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="affiliate-subid">Sub ID</Label>
                <Input id="affiliate-subid" value={form.subId} onChange={(event) => updateField('subId', event.target.value)} placeholder="Tùy chọn" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch id="affiliate-active" checked={form.isActive} onCheckedChange={(checked) => updateField('isActive', checked)} />
              <Label htmlFor="affiliate-active">Đang hoạt động</Label>
            </div>

            {formError ? <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{formError}</p> : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Huỷ</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editing ? 'Lưu thay đổi' : 'Tạo link'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá link affiliate?</AlertDialogTitle>
            <AlertDialogDescription>
              Link <strong>{deleting?.title}</strong> và lịch sử click sẽ bị xoá. Các bài đang dùng shortcode
              sẽ không còn thẻ sản phẩm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteBusy}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {deleteBusy ? 'Đang xoá...' : 'Xoá link'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
