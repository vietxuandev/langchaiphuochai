import { GraphQLScalarType, Kind, type ValueNode } from 'graphql';

/** Chuyển AST literal của GraphQL thành giá trị JS (đệ quy cho object/list). */
function parseLiteralValue(ast: ValueNode): unknown {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
      return Number.parseInt(ast.value, 10);
    case Kind.FLOAT:
      return Number.parseFloat(ast.value);
    case Kind.ENUM:
      return ast.value;
    case Kind.NULL:
      return null;
    case Kind.OBJECT: {
      const result: Record<string, unknown> = {};
      for (const field of ast.fields) {
        result[field.name.value] = parseLiteralValue(field.value);
      }
      return result;
    }
    case Kind.LIST:
      return ast.values.map((node) => parseLiteralValue(node));
    case Kind.VARIABLE:
      return undefined;
    default:
      return null;
  }
}

/**
 * Scalar JSON tự viết (không cần thêm dependency) để expose các cột `Json` của Prisma
 * (thuộc tính bất động sản, SEO, extras...) ra GraphQL.
 */
export const GraphQLJSON: GraphQLScalarType = new GraphQLScalarType<unknown, unknown>({
  name: 'JSON',
  description: 'Giá trị JSON tuỳ ý (object, array, string, number, boolean)',
  serialize: (value: unknown): unknown => value,
  parseValue: (value: unknown): unknown => value,
  parseLiteral: (ast: ValueNode): unknown => parseLiteralValue(ast),
});
