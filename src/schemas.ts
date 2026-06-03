import { z } from "zod";

/**
 * Shared zod field builders reused across tool groups. Every `list_*` tool
 * whose SDK request paginates spreads `pagination` into its input shape.
 */
export const page = z
  .number()
  .int()
  .min(1)
  .optional()
  .describe("Page number, 1-indexed. Defaults to 1.");

export const pageSize = z
  .number()
  .int()
  .min(1)
  .max(500)
  .default(50)
  .describe("Items per page (max 500). Defaults to 50; pass page to fetch more.");

/** Spread into a list tool's input shape: `{ ...pagination }`. */
export const pagination = { page, pageSize };
