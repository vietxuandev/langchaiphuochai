import { GraphQLError, type ASTVisitor, type ValidationContext, type ValidationRule } from 'graphql';

export interface AliasLimitOptions {
  /** Số alias tối đa trong một request (frontend hiện không dùng alias nào). */
  maxAliases: number;
  /** Mutation chỉ được gọi một lần mỗi request (chặn gộp hàng trăm lần thử mật khẩu bằng alias). */
  singleUseMutations: string[];
}

/**
 * Validation rule chặn lạm dụng alias của GraphQL.
 *
 * Không có rule này, một request như `{ a: login(...) b: login(...) ... }` thử được rất nhiều
 * mật khẩu cùng lúc, hoặc nhân một query nặng lên hàng trăm lần.
 */
export function aliasLimitRule(options: AliasLimitOptions): ValidationRule {
  const singleUse = new Set(options.singleUseMutations);

  return (context: ValidationContext): ASTVisitor => {
    let aliases = 0;
    const calls = new Map<string, number>();

    return {
      Field(node) {
        if (node.alias) {
          aliases += 1;
          if (aliases === options.maxAliases + 1) {
            context.reportError(
              new GraphQLError(`Mỗi request chỉ được dùng tối đa ${options.maxAliases} alias`, { nodes: [node] }),
            );
          }
        }

        const name = node.name.value;
        if (singleUse.has(name) && context.getParentType()?.name === 'Mutation') {
          const count = (calls.get(name) ?? 0) + 1;
          calls.set(name, count);
          if (count === 2) {
            context.reportError(
              new GraphQLError(`Mỗi request chỉ được gọi "${name}" một lần`, { nodes: [node] }),
            );
          }
        }
      },
    };
  };
}
