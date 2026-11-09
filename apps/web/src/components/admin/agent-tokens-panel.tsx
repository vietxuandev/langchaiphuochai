'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  MCP_SCOPE_DESCRIPTIONS,
  MCP_SCOPE_LABELS,
  McpScope,
  formatDateTime,
} from '@phuochai/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/lib/auth/auth-context';
import {
  useAgentTokensQuery,
  useCreateAgentTokenMutation,
  useRevokeAgentTokenMutation,
  type AgentTokensQuery,
} from '@/generated/graphql';

type TokenRow = AgentTokensQuery['agentTokens'][number];

/** Scope mặc định: đọc + tạo bản nháp + tải ảnh. Xuất bản phải bật riêng. */
const DEFAULT_SCOPES: string[] = [McpScope.POSTS_READ, McpScope.POSTS_WRITE, McpScope.MEDIA_WRITE];

const EXPIRY_OPTIONS = [
  { value: '30', label: '30 ngày' },
  { value: '90', label: '90 ngày' },
  { value: '365', label: '1 năm' },
  { value: '0', label: 'Không hết hạn' },
];

const STATUS_META: Record<string, { label: string; variant: 'success' | 'muted' | 'destructive' }> = {
  ACTIVE: { label: 'Đang dùng', variant: 'success' },
  EXPIRED: { label: 'Hết hạn', variant: 'muted' },
  REVOKED: { label: 'Đã thu hồi', variant: 'destructive' },
};

/**
 * Quản lý token cấp cho AI agent (MCP server).
 *
 * Token gốc chỉ hiện một lần sau khi tạo; DB chỉ lưu hash nên không xem lại được.
 */
export function AgentTokensPanel() {
  const { canManageSystem } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [agentName, setAgentName] = useState('');
  const [scopes, setScopes] = useState<string[]>(DEFAULT_SCOPES);
  const [expiry, setExpiry] = useState('90');
  const [created, setCreated] = useState<{ token: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<TokenRow | null>(null);

  const { data, loading, refetch } = useAgentTokensQuery({
    skip: !canManageSystem,
    fetchPolicy: 'cache-and-network',
  });
  const [createToken, { loading: creating }] = useCreateAgentTokenMutation();
  const [revokeToken, { loading: revoking }] = useRevokeAgentTokenMutation();

  const tokens = useMemo(() => data?.agentTokens ?? [], [data]);
  const activeCount = tokens.filter((token) => token.status === 'ACTIVE').length;

  const resetForm = () => {
    setName('');
    setAgentName('');
    setScopes(DEFAULT_SCOPES);
    setExpiry('90');
  };

  const handleCreate = async () => {
    try {
      const result = await createToken({
        variables: {
          input: {
            name: name.trim(),
            agentName: agentName.trim() || undefined,
            scopes,
            expiresInDays: Number(expiry) > 0 ? Number(expiry) : undefined,
          },
        },
      });
      const payload = result.data?.createAgentToken;
      if (!payload) return;

      setCreateOpen(false);
      setCreated({ token: payload.token, name: payload.record.name });
      setCopied(false);
      resetForm();
      toast.success('Đã tạo token - hãy sao chép và lưu ngay');
      void refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không tạo được token');
    }
  };

  const handleCopy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.token);
      setCopied(true);
      toast.success('Đã sao chép token');
    } catch {
      toast.error('Trình duyệt không cho phép sao chép, hãy chọn và copy thủ công');
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      await revokeToken({ variables: { id: revokeTarget.id } });
      toast.success('Đã thu hồi token');
      setRevokeTarget(null);
      void refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thu hồi được token');
    }
  };

  if (!canManageSystem) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Không có quyền truy cập"
        description="Chỉ quản trị viên mới có thể cấp token cho AI agent."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
            <KeyRound className="h-6 w-6 text-primary" /> Token cho AI agent
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Cấp token để AI agent (Claude Code, Cursor, n8n...) kết nối MCP server và tạo bài viết tự động.
            Token chỉ hiển thị <strong>một lần</strong> khi tạo; hãy lưu vào công cụ của bạn.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Tạo token
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {loading ? 'Đang tải...' : `${tokens.length} token (${activeCount} đang dùng)`}
          </CardTitle>
          <CardDescription>
            Endpoint MCP: <code className="rounded bg-muted px-1 py-0.5 text-xs">{mcpEndpoint()}</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : tokens.length === 0 ? (
            <EmptyState
              icon={KeyRound}
              title="Chưa có token nào"
              description="Tạo token đầu tiên để agent có thể tạo nội dung qua MCP."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên</TableHead>
                    <TableHead>Quyền</TableHead>
                    <TableHead>Token</TableHead>
                    <TableHead>Dùng lần cuối</TableHead>
                    <TableHead>Hết hạn</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokens.map((token) => {
                    const status = STATUS_META[token.status] ?? STATUS_META.ACTIVE;
                    return (
                      <TableRow key={token.id}>
                        <TableCell>
                          <p className="font-medium">{token.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {token.agentName ? `${token.agentName} - ` : ''}
                            {token.userEmail}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {token.scopes.map((scope) => (
                              <Badge key={scope} variant="muted" className="whitespace-nowrap text-[10px]">
                                {MCP_SCOPE_LABELS[scope as McpScope] ?? scope}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs text-muted-foreground">{token.prefix}...</code>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {token.lastUsedAt ? formatDateTime(token.lastUsedAt) : 'Chưa dùng'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {token.expiresAt ? formatDateTime(token.expiresAt) : 'Không hạn'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="whitespace-nowrap">
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Thu hồi token"
                            disabled={token.status === 'REVOKED'}
                            onClick={() => setRevokeTarget(token)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tạo token */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tạo token cho agent</DialogTitle>
            <DialogDescription>
              Đặt tên dễ nhớ và chỉ bật những quyền agent cần. Mặc định agent chỉ tạo được bản nháp.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token-name">Tên token</Label>
              <Input
                id="token-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Claude Code - laptop"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="token-agent">Tên agent (không bắt buộc)</Label>
              <Input
                id="token-agent"
                value={agentName}
                onChange={(event) => setAgentName(event.target.value)}
                placeholder="claude-code"
              />
              <p className="text-xs text-muted-foreground">Tên này được ghi vào bài viết để bạn biết bài do agent nào tạo.</p>
            </div>

            <div className="space-y-2">
              <Label>Quyền</Label>
              <div className="space-y-2 rounded-lg border p-3">
                {Object.values(McpScope).map((scope) => {
                  const checked = scopes.includes(scope);
                  return (
                    <label key={scope} className="flex cursor-pointer items-start gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(next) =>
                          setScopes((current) =>
                            next === true ? [...current, scope] : current.filter((item) => item !== scope),
                          )
                        }
                      />
                      <span>
                        <span className="font-medium">{MCP_SCOPE_LABELS[scope]}</span>
                        <span className="block text-xs text-muted-foreground">{MCP_SCOPE_DESCRIPTIONS[scope]}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Khuyến nghị không bật &quot;Xuất bản&quot; cho agent: để bạn duyệt bài trước khi đăng.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Hiệu lực</Label>
              <Select value={expiry} onValueChange={setExpiry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Huỷ
            </Button>
            <Button onClick={handleCreate} disabled={creating || name.trim().length < 2 || scopes.length === 0}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Tạo token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hiện token một lần */}
      <Dialog open={Boolean(created)} onOpenChange={(open) => (open ? undefined : setCreated(null))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" /> Token đã tạo
            </DialogTitle>
            <DialogDescription>
              Sao chép token ngay bây giờ. Bạn sẽ <strong>không xem lại</strong> được token này sau khi đóng hộp thoại.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Không chia sẻ token trong chat công khai. Nếu lộ, hãy thu hồi và tạo token mới.
            </div>

            <div className="space-y-2">
              <Label>Token cho &quot;{created?.name}&quot;</Label>
              <div className="flex gap-2">
                <Input readOnly value={created?.token ?? ''} className="font-mono text-xs" />
                <Button type="button" variant="outline" onClick={handleCopy}>
                  {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copied ? 'Đã copy' : 'Copy'}
                </Button>
              </div>
            </div>

            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Cấu hình cho Claude Code (.mcp.json)</p>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all">
{`{
  "mcpServers": {
    "phuochai": {
      "type": "http",
      "url": "${mcpEndpoint()}",
      "headers": { "Authorization": "Bearer ${'<token>'}" }
    }
  }
}`}
              </pre>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setCreated(null)}>Đã lưu, đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Thu hồi */}
      <AlertDialog open={Boolean(revokeTarget)} onOpenChange={(open) => (open ? undefined : setRevokeTarget(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Thu hồi token?</AlertDialogTitle>
            <AlertDialogDescription>
              Token <strong>{revokeTarget?.name}</strong> sẽ ngừng hoạt động ngay lập tức. Agent đang dùng token này sẽ
              nhận lỗi 401.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={revoking}
              onClick={handleRevoke}
            >
              {revoking ? 'Đang thu hồi...' : 'Thu hồi'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** URL MCP công khai (build-time), cùng nguồn với biến môi trường MCP_PUBLIC_URL. */
function mcpEndpoint(): string {
  const base = process.env.NEXT_PUBLIC_MCP_URL ?? 'https://mcp.langchaiphuochai.com';
  return `${base.replace(/\/+$/, '')}/mcp`;
}
