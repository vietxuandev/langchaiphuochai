'use client';

import { useEffect, useState } from 'react';
import { Loader2, Play, Save } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '@phuochai/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/auth/auth-context';
import {
  useFacebookQueueQuery,
  useRunFacebookQueueNowMutation,
  useUpdateFacebookQueueMutation,
} from '@/generated/graphql';

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

  const [times, setTimes] = useState('');
  useEffect(() => {
    if (queue) setTimes(queue.postTimes.join(', '));
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
    if (!window.confirm('Đăng ngay bài kế tiếp trong hàng chờ lên Facebook?')) return;
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
    }
  };

  if (!canManageSystem) return <p className="text-sm text-muted-foreground">Chỉ quản trị viên được truy cập.</p>;
  if (loading && !queue) return <Skeleton className="h-64 w-full" />;
  if (!queue) return null;

  const parsedTimes = times.split(',').map((t) => t.trim()).filter(Boolean);

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
          <div className="space-y-2">
            <Label htmlFor="fbq-times">Khung giờ đăng (giờ Việt Nam)</Label>
            <div className="flex gap-2">
              <Input id="fbq-times" value={times} onChange={(e) => setTimes(e.target.value)} placeholder="08:00, 19:30" />
              <Button type="button" disabled={saving || parsedTimes.length === 0} onClick={() => save({ postTimes: parsedTimes }, 'Đã lưu khung giờ')}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Lưu
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Phân tách bằng dấu phẩy, dạng HH:mm. Số bài mỗi ngày = số khung giờ (hiện {queue.postsPerDay} bài/ngày).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="font-display text-base">Hàng chờ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Đang chờ đăng: <strong>{queue.pendingCount}</strong> bài
          </p>
          <p>
            Bị bỏ qua vì chưa có nội dung Facebook: <strong>{queue.missingCaptionCount}</strong> bài
          </p>
          <p>Bài kế tiếp: {queue.nextPostTitle ?? '—'}</p>
          <p>Khung giờ kế tiếp: {queue.enabled ? (queue.nextSlot ?? '—') : 'Đang tắt'}</p>
          <p>Lần chạy gần nhất: {queue.lastRunAt ? formatDateTime(queue.lastRunAt) : '—'}</p>
          {queue.lastError ? <p className="text-destructive">Lỗi gần nhất: {queue.lastError}</p> : null}
          <Button type="button" variant="outline" size="sm" disabled={running} onClick={handleRunNow}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Đăng bài kế tiếp ngay
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
