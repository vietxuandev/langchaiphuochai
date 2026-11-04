interface JsonLdProps {
  /** Một object hoặc graph schema.org. */
  data: Record<string, unknown>;
  /** id tuỳ chọn để dễ debug trong HTML. */
  id?: string;
}

/**
 * Render JSON-LD an toàn.
 *
 * `JSON.stringify` bỏ qua các field `undefined`, còn `<` được escape để tránh
 * trường hợp nội dung vô tình đóng thẻ `</script>`.
 */
export function JsonLd({ data, id }: JsonLdProps) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');

  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
