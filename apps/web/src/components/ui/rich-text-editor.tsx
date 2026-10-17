'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { TableKit } from '@tiptap/extension-table';
import { CharacterCount } from '@tiptap/extensions';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Code2,
  Eraser,
  Heading2,
  Heading3,
  Heading4,
  ImagePlus,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Table as TableIcon,
  Underline as UnderlineIcon,
  Undo2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { UPLOAD } from '@phuochai/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { uploadImage } from '@/lib/uploads';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  /** Nội dung HTML hiện tại (đồng bộ với react-hook-form). */
  value: string;
  /** Gọi mỗi khi nội dung thay đổi, trả về HTML. */
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  /** Ẩn/hiện chế độ HTML (mặc định cho phép). */
  allowHtmlMode?: boolean;
}

/** Nút trên thanh công cụ, có tooltip tiếng Việt. */
function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={active ? 'secondary' : 'ghost'}
          size="icon"
          className={cn('h-8 w-8', active && 'bg-primary/10 text-primary')}
          disabled={disabled}
          onClick={onClick}
          aria-label={label}
          aria-pressed={active}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function ToolbarDivider() {
  return <Separator orientation="vertical" className="mx-0.5 h-6" />;
}

/**
 * Editor trực quan (WYSIWYG) dùng Tiptap - thay cho việc gõ HTML thủ công.
 *
 * - Thanh công cụ tiếng Việt: định dạng chữ, tiêu đề, danh sách, trích dẫn, bảng, căn lề, liên kết.
 * - Chèn ảnh bằng cách tải file lên trực tiếp (lưu vào thư mục upload/ của máy chủ).
 * - Có chế độ xem/sửa HTML cho người rành kỹ thuật (đồng bộ hai chiều).
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Nhập nội dung bài viết...',
  className,
  allowHtmlMode = true,
}: RichTextEditorProps) {
  const [htmlMode, setHtmlMode] = useState(false);
  const [htmlDraft, setHtmlDraft] = useState(value);
  const [uploading, setUploading] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    // Bắt buộc với Next.js: không render ngay trên server để tránh lệch hydration.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
        },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
      TableKit.configure({ table: { resizable: true } }),
      CharacterCount,
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'prose-phuochai max-w-none min-h-[420px] px-4 py-3 focus:outline-none',
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChangeRef.current(instance.getHTML());
    },
  });

  /** Đồng bộ khi giá trị bên ngoài thay đổi (ví dụ: nạp bài viết để sửa). */
  useEffect(() => {
    if (!editor) return;
    if (value === editor.getHTML()) return;
    editor.commands.setContent(value || '', { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (!htmlMode) setHtmlDraft(value);
  }, [value, htmlMode]);

  const insertImages = useCallback(
    async (files: FileList | null) => {
      if (!editor || !files?.length) return;
      setUploading(true);
      let uploaded = 0;
      try {
        for (const file of Array.from(files)) {
          const result = await uploadImage(file, UPLOAD.postsFolder);
          editor.chain().focus().setImage({ src: result.path, alt: file.name }).run();
          uploaded += 1;
        }
        toast.success(`Đã chèn ${uploaded} ảnh vào nội dung`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không tải được ảnh');
      } finally {
        setUploading(false);
      }
    },
    [editor],
  );

  if (!editor) {
    return (
      <div className={cn('flex min-h-[420px] items-center justify-center rounded-lg border', className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const characterCount = editor.storage.characterCount as { characters: () => number; words: () => number };
  const activeHeading = [2, 3, 4].find((level) => editor.isActive('heading', { level }));

  return (
    <div className={cn('rounded-lg border border-input bg-background shadow-sm', className)}>
      {/* ------------------------------ Thanh công cụ ------------------------------ */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 p-1.5">
        <ToolbarButton label="Hoàn tác (Ctrl+Z)" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Làm lại (Ctrl+Shift+Z)" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Kiểu đoạn văn */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs">
                  {activeHeading ? (
                    <>
                      <Heading2 className="h-4 w-4" /> Tiêu đề {activeHeading}
                    </>
                  ) : (
                    <>
                      <Pilcrow className="h-4 w-4" /> Đoạn văn
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Kiểu đoạn văn</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>Kiểu đoạn văn</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => editor.chain().focus().setParagraph().run()}>
              <Pilcrow className="mr-2 h-4 w-4" /> Đoạn văn thường
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
              <Heading2 className="mr-2 h-4 w-4" /> Tiêu đề lớn (H2)
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
              <Heading3 className="mr-2 h-4 w-4" /> Tiêu đề vừa (H3)
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}>
              <Heading4 className="mr-2 h-4 w-4" /> Tiêu đề nhỏ (H4)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ToolbarDivider />

        <ToolbarButton
          label="In đậm (Ctrl+B)"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="In nghiêng (Ctrl+I)"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Gạch chân (Ctrl+U)"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Gạch ngang chữ"
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Chữ nổi bật (code)"
          active={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          label="Danh sách dấu đầu dòng"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Danh sách đánh số"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Trích dẫn"
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Khối mã"
          active={editor.isActive('codeBlock')}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <Code2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Đường kẻ ngang" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          label="Căn trái"
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Căn giữa"
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Căn phải"
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Căn đều hai bên"
          active={editor.isActive({ textAlign: 'justify' })}
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        >
          <AlignJustify className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Chèn ảnh */}
        <input
          ref={fileInputRef}
          type="file"
          accept={UPLOAD.allowedMimeTypes.join(',')}
          multiple
          className="hidden"
          onChange={(event) => {
            void insertImages(event.target.files);
            event.target.value = '';
          }}
        />
        <ToolbarButton
          label={uploading ? 'Đang tải ảnh...' : 'Chèn ảnh từ máy tính'}
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        </ToolbarButton>

        {/* Liên kết */}
        <ToolbarButton
          label="Chèn liên kết"
          active={editor.isActive('link')}
          onClick={() => {
            setLinkUrl(editor.getAttributes('link').href ?? '');
            setLinkDialogOpen(true);
          }}
        >
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Bỏ liên kết"
          disabled={!editor.isActive('link')}
          onClick={() => editor.chain().focus().unsetLink().run()}
        >
          <Link2Off className="h-4 w-4" />
        </ToolbarButton>

        {/* Bảng */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant={editor.isActive('table') ? 'secondary' : 'ghost'}
                  size="icon"
                  className={cn('h-8 w-8', editor.isActive('table') && 'bg-primary/10 text-primary')}
                  aria-label="Bảng biểu"
                >
                  <TableIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Bảng biểu</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Bảng biểu</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            >
              Chèn bảng 3 × 3
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => editor.chain().focus().addRowAfter().run()}>
              Thêm dòng bên dưới
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => editor.chain().focus().addColumnAfter().run()}>
              Thêm cột bên phải
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => editor.chain().focus().deleteRow().run()}>Xoá dòng</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => editor.chain().focus().deleteColumn().run()}>Xoá cột</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => editor.chain().focus().toggleHeaderRow().run()}>
              Bật/tắt dòng tiêu đề
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onSelect={() => editor.chain().focus().deleteTable().run()}>
              Xoá cả bảng
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ToolbarButton
          label="Xoá định dạng"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        >
          <Eraser className="h-4 w-4" />
        </ToolbarButton>

        {allowHtmlMode ? (
          <>
            <div className="ml-auto flex items-center gap-1">
              <Button
                type="button"
                variant={htmlMode ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 gap-1 px-2 text-xs"
                onClick={() => {
                  if (!htmlMode) setHtmlDraft(editor.getHTML());
                  setHtmlMode((current) => !current);
                }}
              >
                <Code2 className="h-3.5 w-3.5" />
                {htmlMode ? 'Xem trực quan' : 'Chế độ HTML'}
              </Button>
            </div>
          </>
        ) : null}
      </div>

      {/* -------------------------------- Nội dung -------------------------------- */}
      {htmlMode ? (
        <div className="space-y-2 p-3">
          <p className="text-xs text-muted-foreground">
            Chế độ HTML dành cho người rành kỹ thuật - giữ nguyên mọi cấu trúc gốc của bài viết.
          </p>
          <Textarea
            value={htmlDraft}
            onChange={(event) => setHtmlDraft(event.target.value)}
            rows={18}
            className="font-mono text-xs leading-relaxed"
            spellCheck={false}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setHtmlDraft(editor.getHTML());
                setHtmlMode(false);
              }}
            >
              Huỷ
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                editor.commands.setContent(htmlDraft || '', { emitUpdate: false });
                onChange(htmlDraft);
                setHtmlMode(false);
                toast.success('Đã cập nhật nội dung từ HTML');
              }}
            >
              Áp dụng HTML
            </Button>
          </div>
        </div>
      ) : (
        <EditorContent editor={editor} />
      )}

      {/* --------------------------------- Chân trang ------------------------------ */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
        <span>
          {characterCount?.characters?.() ?? 0} ký tự · {characterCount?.words?.() ?? 0} từ
        </span>
        <span className="hidden sm:inline">
          Mẹo: bôi đen đoạn văn rồi chọn định dạng; kéo-thả ảnh hoặc bấm nút ảnh để tải lên.
        </span>
      </div>

      {/* ------------------------------- Dialog liên kết --------------------------- */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Chèn liên kết</DialogTitle>
            <DialogDescription>Nhập địa chỉ trang hoặc tệp bạn muốn liên kết tới.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="editor-link-url">Địa chỉ liên kết</Label>
            <Input
              id="editor-link-url"
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="https://langchaiphuochai.com/luu-tru/..."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Huỷ
            </Button>
            <Button
              type="button"
              onClick={() => {
                const url = linkUrl.trim();
                if (!url) {
                  editor.chain().focus().unsetLink().run();
                } else {
                  editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
                }
                setLinkDialogOpen(false);
              }}
            >
              Áp dụng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
