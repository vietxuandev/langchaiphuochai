'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { POST_STATUS_LABELS, POST_TYPE_LABELS, PostStatus, formatDateTime } from '@phuochai/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  useCrawlCheckLazyQuery,
  useCrawlImportMutation,
  useCrawlPreviewQuery,
  type CrawlCandidateStatus,
  type CrawlCheckQuery,
} from '@/generated/graphql';

type Candidate = CrawlCheckQuery['crawlCheck']['candidates'][number];

/** Giá trị của enum `CrawlCandidateStatus` (codegen sinh ra dạng union string). */
const STATUS = {
  NEW: 'NEW',
  EXISTING: 'EXISTING',
  ERROR: 'ERROR',
} as const satisfies Record<string, CrawlCandidateStatus>;

const STATUS_META: Record<
  CrawlCandidateStatus,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  [STATUS.NEW]: {
    label: 'Bài mới',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    icon: Sparkles,
  },
  [STATUS.EXISTING]: {
    label: 'Đã có',
    className: 'bg-muted text-muted-foreground',
    icon: CheckCircle2,
  },
  [STATUS.ERROR]: {
    label: 'Lỗi',
    className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    icon: XCircle,
  },
};

/**
 * Công cụ crawl bài mới từ website cũ (phuochai.com).
 *
 * HAI BƯỚC, không ghi dữ liệu ở bước 1:
 *  1. "Kiểm tra" - tải & parse bài trên web cũ, đối chiếu database, hiện danh sách để duyệt.
 *  2. "Import" - chỉ những bài được tick mới được ghi (kèm tải ảnh về /upload).
 */
export function CrawlPanel() {
  const [rawInput, setRawInput] = useState('');
  const [scanListings, setScanListings] = useState(true);
  const [listingLimit, setListingLimit] = useState(12);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importStatus, setImportStatus] = useState<PostStatus>(PostStatus.DRAFT);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: string[]; errors: string[] } | null>(null);

  const [runCheck, { data, loading, error, refetch }] = useCrawlCheckLazyQuery({
    fetchPolicy: 'network-only',
  });
  const [importPosts, { loading: importing }] = useCrawlImportMutation();

  const candidates = useMemo(() => data?.crawlCheck.candidates ?? [], [data]);
  const warnings = data?.crawlCheck.warnings ?? [];
  const newCandidates = candidates.filter((candidate) => candidate.status === STATUS.NEW);
  const selectedCount = selected.size;

  const handleCheck = async () => {
    setResult(null);
    setSelected(new Set());

    const lines = rawInput
      .split(/[\n,]+/)
      .map((line) => line.trim())
      .filter(Boolean);

    const urls: string[] = [];
    const slugs: string[] = [];
    for (const line of lines) {
      // Có dấu "/" hoặc đuôi .html -> coi là URL, ngược lại là slug
      if (line.includes('/') || /\.html?$/i.test(line)) urls.push(line);
      else slugs.push(line);
    }

    try {
      const response = await runCheck({
        variables: {
          input: {
          urls: urls.length > 0 ? urls : undefined,
          slugs: slugs.length > 0 ? slugs : undefined,
          scanListings,
            listingLimit,
          },
        },
      });
      const found = response.data?.crawlCheck.candidates ?? [];
      const newCount = found.filter((candidate) => candidate.status === STATUS.NEW).length;
      if (found.length === 0) toast.info('Không tìm thấy bài nào');
      else toast.success(`Tìm thấy ${found.length} bài, trong đó ${newCount} bài mới`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Không kiểm tra được');
    }
  };

  const handleImport = async () => {
    if (selectedCount === 0) return;
    try {
      const response = await importPosts({
        variables: { input: { ids: [...selected], status: importStatus } },
      });
      const payload = response.data?.crawlImport;
      if (!payload) return;

      setResult({ created: payload.created.length, skipped: payload.skipped, errors: payload.errors });
      setSelected(new Set());

      if (payload.created.length > 0) {
        toast.success(
          `Đã import ${payload.created.length} bài (${POST_STATUS_LABELS[importStatus]}). Xem tại Bài viết.`,
        );
      }
      if (payload.errors.length > 0) toast.error(`${payload.errors.length} bài lỗi, xem chi tiết bên dưới`);
      await refetch();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Import thất bại');
    }
  };

  const toggleOne = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllNew = () => {
    setSelected((current) => {
      const allSelected = newAllSelected(current, newCandidates);
      return allSelected ? new Set() : new Set(newCandidates.map((candidate) => candidate.id));
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
          <RefreshCw className="h-6 w-6 text-primary" /> Crawl bài mới
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lấy bài viết mới đăng trên website cũ (phuochai.com) về để duyệt. Bước kiểm tra chỉ crawl{' '}
          <strong>tiêu đề và mô tả ngắn</strong> - không đọc nội dung bài, không giữ gì trong bộ nhớ, không ghi
          database. Nội dung đầy đủ và ảnh chỉ được tải khi bạn bấm <strong>Xem</strong> hoặc <strong>Import</strong>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Kiểm tra bài mới</CardTitle>
          <CardDescription>
            Dán URL hoặc slug bài viết trên web cũ (mỗi dòng một bài), hoặc bật quét trang danh sách để tự tìm bài mới.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="crawl-input">URL hoặc slug bài viết</Label>
            <Textarea
              id="crawl-input"
              value={rawInput}
              onChange={(event) => setRawInput(event.target.value)}
              rows={3}
              placeholder={'/tin-tuc/an-gi-o-phuoc-hai-166.html\nhttps://phuochai.com/khach-san-nao-978-33.html\nan-gi-o-phuoc-hai'}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Nhận cả URL đầy đủ, đường dẫn và slug. Slug được tra trong danh sách bài của web cũ.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={scanListings}
                onCheckedChange={(checked) => setScanListings(checked === true)}
              />
              Quét trang danh sách tìm bài mới
            </label>

            <div className="w-32 space-y-1">
              <Label htmlFor="crawl-limit" className="text-xs">
                Số bài tối đa
              </Label>
              <Input
                id="crawl-limit"
                type="number"
                min={1}
                max={50}
                value={listingLimit}
                onChange={(event) => setListingLimit(Number(event.target.value) || 12)}
                disabled={!scanListings}
              />
            </div>

            <Button onClick={handleCheck} disabled={loading || (!rawInput.trim() && !scanListings)}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              {loading ? 'Đang kiểm tra...' : 'Kiểm tra'}
            </Button>
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error.message}</span>
            </div>
          ) : null}

          {warnings.length > 0 ? (
            <ul className="space-y-1 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {warnings.map((warning) => (
                <li key={warning} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {warning}
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      {loading ? <ResultSkeleton /> : null}

      {!loading && data ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">
                2. Duyệt và import ({data.crawlCheck.checked} bài, {newCandidates.length} bài mới)
              </CardTitle>
              <CardDescription>
                Danh sách chỉ gồm tiêu đề + mô tả ngắn. Tick bài muốn đưa vào database rồi bấm Import để tải nội dung và ảnh.
              </CardDescription>
            </div>
            {newCandidates.length > 0 ? (
              <Button variant="outline" size="sm" onClick={toggleAllNew}>
                {newAllSelected(selected, newCandidates) ? 'Bỏ chọn tất cả' : 'Chọn tất cả bài mới'}
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {candidates.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Không có bài nào. Hãy dán URL/slug hoặc bật quét trang danh sách.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Bài viết</TableHead>
                      <TableHead className="w-32">Loại</TableHead>
                      <TableHead className="w-28">Trạng thái</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.map((candidate) => (
                      <CandidateRow
                        key={candidate.id}
                        candidate={candidate}
                        checked={selected.has(candidate.id)}
                        onToggle={() => toggleOne(candidate.id)}
                        onPreview={() => setPreviewId(candidate.id)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-3">
              <span className="text-sm font-medium">Đã chọn: {selectedCount} bài</span>

              <div className="flex items-center gap-2">
                <Label htmlFor="import-status" className="text-sm">
                  Trạng thái sau import
                </Label>
                <Select value={importStatus} onValueChange={(value) => setImportStatus(value as PostStatus)}>
                  <SelectTrigger id="import-status" className="h-9 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PostStatus.DRAFT}>{POST_STATUS_LABELS[PostStatus.DRAFT]}</SelectItem>
                    <SelectItem value={PostStatus.PUBLISHED}>{POST_STATUS_LABELS[PostStatus.PUBLISHED]}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleImport} disabled={selectedCount === 0 || importing} className="ml-auto">
                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                {importing ? 'Đang import...' : `Import ${selectedCount} bài`}
              </Button>
            </div>

            {result ? (
              <div className="space-y-2 rounded-lg border p-3 text-sm">
                <p className="font-medium text-emerald-700 dark:text-emerald-400">
                  Đã tạo {result.created} bài. {result.skipped.length > 0 ? `Bỏ qua ${result.skipped.length}.` : ''}
                </p>
                {result.skipped.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                    {result.skipped.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                ) : null}
                {result.errors.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5 text-xs text-destructive">
                    {result.errors.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                ) : null}
                <Link href="/quan-tri/bai-viet" className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                  Xem danh sách bài viết <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <PreviewDialog id={previewId} onClose={() => setPreviewId(null)} />
    </div>
  );
}

function CandidateRow({
  candidate,
  checked,
  onToggle,
  onPreview,
}: {
  candidate: Candidate;
  checked: boolean;
  onToggle: () => void;
  onPreview: () => void;
}) {
  const meta = STATUS_META[candidate.status];
  const Icon = meta.icon;
  const canSelect = candidate.status === STATUS.NEW;

  return (
    <TableRow className={checked ? 'bg-primary/5' : undefined}>
      <TableCell>
        <Checkbox checked={checked} onCheckedChange={onToggle} disabled={!canSelect} aria-label="Chọn bài" />
      </TableCell>
      <TableCell>
        <div className="flex items-start gap-3">
          {candidate.thumbnailUrl ? (
            // Ảnh xem trước nằm trên web cũ nên dùng <img> thường (không qua next/image)
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={candidate.thumbnailUrl}
              alt=""
              className="h-14 w-20 shrink-0 rounded object-cover"
              loading="lazy"
            />
          ) : (
            <div className="h-14 w-20 shrink-0 rounded bg-muted" />
          )}
          <div className="min-w-0 space-y-1">
            <p className="line-clamp-2 text-sm font-medium">{candidate.title}</p>
            {candidate.description ? (
              <p className="line-clamp-2 text-xs text-muted-foreground">{candidate.description}</p>
            ) : (
              <p className="text-xs italic text-muted-foreground">(trang không có mô tả ngắn)</p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span className="font-mono">{candidate.slug}</span>
              {candidate.publishedAt ? <span>{formatDateTime(candidate.publishedAt)}</span> : null}
              <a
                href={candidate.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Web cũ <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            {candidate.status === STATUS.ERROR && candidate.error ? (
              <p className="text-[11px] text-destructive">{candidate.error}</p>
            ) : null}
            {candidate.status === STATUS.EXISTING && candidate.existingPostSlug ? (
              <Link
                href={`/quan-tri/bai-viet/${candidate.existingPostId}`}
                className="text-[11px] text-primary hover:underline"
              >
                Bài đã có: {candidate.existingPostSlug}
              </Link>
            ) : null}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="muted" className="text-[11px]">
          {POST_TYPE_LABELS[candidate.type]}
        </Badge>
      </TableCell>

      <TableCell>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>
          <Icon className="h-3 w-3" /> {meta.label}
        </span>
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="sm" onClick={onPreview}>
          Xem
        </Button>
      </TableCell>
    </TableRow>
  );
}

/** Dialog xem trước nội dung (chỉ hiện text + ảnh, không render HTML từ web cũ). */
function PreviewDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, loading } = useCrawlPreviewQuery({ variables: { id: id ?? '' }, skip: !id });

  return (
    <Dialog open={Boolean(id)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nội dung đầy đủ của bài viết</DialogTitle>
          <DialogDescription>
            Nội dung đầy đủ được tải từ web cũ ngay lúc mở hộp thoại này (không lưu trong bộ nhớ). Ảnh chỉ được tải về
            server mới khi bạn bấm Import.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        ) : (
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {data?.crawlPreview.text?.slice(0, 4000) ?? 'Không có nội dung text.'}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResultSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <Skeleton className="h-5 w-52" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </CardContent>
    </Card>
  );
}

function newAllSelected(selected: Set<string>, candidates: Candidate[]): boolean {
  return candidates.length > 0 && candidates.every((candidate) => selected.has(candidate.id));
}
