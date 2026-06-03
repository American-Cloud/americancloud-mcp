import type { ZodRawShape, ZodTypeAny, infer as ZodInfer } from "zod";
import type { AmericancloudApiClient } from "@americancloud/sdk";

/**
 * Service groups. Users scope the tool surface with `--services <csv|all>`.
 * DEFAULT_GROUPS are the core infrastructure building blocks enabled when no
 * flag is given; the rest are opt-in extras.
 */
export const GROUPS = [
  "compute",
  "storage",
  "networking",
  "kubernetes",
  "databases",
  "wordpress",
  "dns",
] as const;
export type Group = (typeof GROUPS)[number];

export const DEFAULT_GROUPS: readonly Group[] = [
  "compute",
  "storage",
  "networking",
  "kubernetes",
];

/**
 * One MCP tool wrapping exactly one SDK method.
 *
 * Invariants (enforced by review + test/coverage.ts):
 * - `sdkRef` is the mandatory back-reference `"<namespace>.<method>"` on the
 *   SDK client; every SDK method is either a ToolDef or a NOT_EXPOSED entry.
 * - `description` must NOT hand-write a destructive warning — the server
 *   prepends `⚠️ DESTRUCTIVE — ` from the `destructive` flag (one source).
 * - `inputSchema` is a zod RAW SHAPE (a plain object of zod fields), not
 *   z.object(...): the MCP SDK consumes raw shapes.
 */
export interface ToolDef<Shape extends ZodRawShape = ZodRawShape> {
  /** snake_case verb_noun, e.g. "create_vm", "list_vms", "power_vm". */
  name: string;
  /** Human display title, e.g. "Create VM". */
  title: string;
  /** 1–3 sentences written for LLM tool-selection (what it does, key params, cross-tool pointers). */
  description: string;
  group: Group;
  /** Mandatory "<namespace>.<method>" back-reference, e.g. "vms.createVms". */
  sdkRef: string;
  /** GET-like, no side effects → readOnlyHint. */
  readOnly: boolean;
  /** Irreversible data/resource loss → destructiveHint + description prefix. */
  destructive?: boolean;
  /** Same call twice converges to the same state → idempotentHint. */
  idempotent?: boolean;
  inputSchema: Shape;
  run(
    client: AmericancloudApiClient,
    args: { [K in keyof Shape]: Shape[K] extends ZodTypeAny ? ZodInfer<Shape[K]> : never },
  ): Promise<unknown>;
}

/** Identity helper that preserves the shape generic for arg inference. */
export function defineTool<Shape extends ZodRawShape>(def: ToolDef<Shape>): ToolDef<Shape> {
  return def;
}
