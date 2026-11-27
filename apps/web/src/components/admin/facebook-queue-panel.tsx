'use client';

import { useEffect, useState } from 'react';
import { Loader2, Play, Plus, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '@phuochai/shared';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/auth/auth-context';
import {
  useFacebookQueueQuery,
  useRunFacebookQueueNowMutation,
  useUpdateFacebookQueueMutation,
} from '@/generated/graphql';

/** Các mốc giờ cách nhau 30 phút trong ngày: 00:00, 00:30, ..., 23:30. */
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = String(Math.floor(i / 2)).padStart(2, '0');
  return `${hour}:${i % 2 === 0 ? '00' : '30'}`;
});

/** Cấu hình hàng chờ tự đăng Facebook: mỗi khung giờ đăng 1 bài tin tức cũ nhất chưa đăng. */
export function FacebookQueuePanel() {
  const { canManageSystem } = useAuth();
  const { data, loading, refetch } = useFacebookQueueQuery({
    skip: !canManageSystem,
    fetchPolicy: 'cache-and-network',
  });
  const [update, { loading: saving }] = useUpdateFacebookQueueMutation();
  const [runNow, { loading: running }] = useRunFacebookQueueNowMutation();
  const queue = data?.facebookQueue;

  const [slots, setSlots] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  useEffect(() => {
    if (queue) setSlots(queue.postTimes);
  }, [queue]);

  const save = async (variables: { enabled?: boolean; onlyNews?: boolean; postTimes?: string[] }, message: string) => {
    try {
      const result = await update({ variables });
      if (result.errors?.length) throw new Error(result.errors[0].message);
      toast.success(message);
      void refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không lưu được cấu hình');
    }
  };

  const handleRunNow = async () => {
    try {
      const result = await runNow();
      const payload = result.data?.runFacebookQueueNow;
      if (!payload) throw new Error(result.errors?.[0]?.message ?? 'Không chạy được');
      if (payload.error) toast.error(`Đăng thất bại: ${payload.error}`);
      else if (payload.posted) toast.success(`Đã đăng: ${payload.title}`);
      else toast.info('Hàng chờ đang trống (không có bài đã có caption chờ đăng)');
      void refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không chạy được');
    } finally {
      setConfirmOpen(false);
    }
  };

  if (!canManageSystem) return <p className="text-sm text-muted-foreground">Chỉ quản trị viên được truy cập.</p>;
  if (loading && !queue) return <Skeleton className="h-64 w-full" />;
  if (!queue) return null;

  const nextFreeSlot = TIME_OPTIONS.find((t) => !slots.includes(t));
  const uniqueSlots = [...new Set(slots)].sort();
  const changed = uniqueSlots.join(',') !== queue.postTimes.join(',');

  return (
    <div className="max-w-2xl space-y-4">
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="font-display text-base">Tự đăng bài lên Facebook</CardTitle>
          <CardDescription>
            Mỗi khung giờ, hệ thống đăng 1 bài đã xuất bản và có nội dung Facebook, từ cũ nhất đến mới nhất. Bài mới
            xuất bản sẽ vào cuối hàng chờ.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <Label htmlFor="fbq-enabled">Bật tự động đăng</Label>
            <Switch
              id="fbq-enabled"
              checked={queue.enabled}
              disabled={saving}
              onCheckedChange={(enabled) => save({ enabled }, enabled ? 'Đã bật tự đăng' : 'Đã tắt tự đăng')}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="fbq-news">Chỉ đăng bài Tin tức</Label>
            <Switch
              id="fbq-news"
              checked={queue.onlyNews}
              disabled={saving}
              onCheckedChange={(onlyNews) => save({ onlyNews }, 'Đã lưu')}
            />
          </div>
          <div className="space-y-3">
            <Label>Khung giờ đăng (giờ Việt Nam)</Label>
            <div className="flex flex-wrap gap-2">
              {slots.map((slot, index) => (
                <div key={index} className="flex items-center gap-1">
                  <Select value={slot} onValueChange={(value) => setSlots(slots.map((t, i) => (i === index ? value : t)))}>
                    <SelectTrigger className="w-[110px]" aria-label={`Khung giờ ${index + 1}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(TIME_OPTIONS.includes(slot) ? TIME_OPTIONS : [...TIME_OPTIONS, slot].sort()).map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    disabled={slots.length <= 1}
                    aria-label="Xoá khung giờ"
                    onClick={() => setSlots(slots.filter((_, i) => i !== index))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                disabled={!nextFreeSlot || slots.length >= 24}
                onClick={() => nextFreeSlot && setSlots([...slots, nextFreeSlot])}
              >
                <Plus className="h-4 w-4" />
                Thêm giờ
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Mỗi khung giờ đăng 1 bài, hiện {queue.postsPerDay} bài/ngày.
              </p>
              <Button
                type="button"
                disabled={saving || slots.length === 0 || !changed}
                onClick={() => save({ postTimes: uniqueSlots }, 'Đã lưu khung giờ')}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Lưu
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="font-display text-base">Hàng chờ</CardTitle>
            <CardDescription>Bài kế tiếp được lấy từ danh sách đã có nội dung Facebook.</CardDescription>
          </div>
          <Badge variant={queue.enabled ? 'default' : 'secondary'}>{queue.enabled ? 'Đang bật' : 'Đang tắt'}</Badge>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/70 p-3">
              <p className="text-xs text-muted-foreground">Đang chờ đăng</p>
              <p className="mt-1 font-display text-2xl font-semibold">{queue.pendingCount} bài</p>
            </div>
            <div className="rounded-lg border border-border/70 p-3">
              <p className="text-xs text-muted-foreground">Bị bỏ qua vì chưa có nội dung Facebook</p>
              <p className="mt-1 font-display text-2xl font-semibold">{queue.missingCaptionCount} bài</p>
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Bài kế tiếp</p>
            <p className="mt-1 text-sm font-medium">{queue.nextPostTitle ?? '—'}</p>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Khung giờ kế tiếp</dt>
              <dd className="mt-0.5">{queue.enabled ? (queue.nextSlot ?? '—') : 'Đang tắt'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Lần chạy gần nhất</dt>
              <dd className="mt-0.5">{queue.lastRunAt ? formatDateTime(queue.lastRunAt) : '—'}</dd>
            </div>
          </dl>

          {queue.lastError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              Lỗi gần nhất: {queue.lastError}
            </p>
          ) : null}

          <Button
            type="button"
            variant="outline"
            disabled={running || !queue.nextPostTitle}
            onClick={() => setConfirmOpen(true)}
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Đăng bài kế tiếp ngay
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => (running ? undefined : setConfirmOpen(open))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Đăng bài kế tiếp ngay?</AlertDialogTitle>
            <AlertDialogDescription>
              Bài <strong>{queue.nextPostTitle}</strong> sẽ được đăng lên Facebook Page ngay lập tức, không chờ khung giờ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={running}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              disabled={running}
              onClick={(event) => {
                event.preventDefault();
                void handleRunNow();
              }}
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Đăng ngay
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
