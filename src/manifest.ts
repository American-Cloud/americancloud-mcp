import type { ToolDef } from "./tooldef.js";
import { computeTools } from "./tools/compute.js";
import { dnsTools } from "./tools/dns.js";
import { storageTools } from "./tools/storage.js";
import { kubernetesTools } from "./tools/kubernetes.js";
import { wordpressTools } from "./tools/wordpress.js";
import { networkingTools } from "./tools/networking.js";
import { databasesTools } from "./tools/databases.js";

/**
 * Every tool the server can register, across all groups. Group/read-only
 * filtering happens at registration time in server.ts.
 */
export const ALL_TOOLS: ToolDef[] = [
  ...computeTools,
  ...dnsTools,
  ...storageTools,
  ...kubernetesTools,
  ...wordpressTools,
  ...networkingTools,
  ...databasesTools,
];

/**
 * SDK methods deliberately NOT exposed as tools, keyed by sdkRef
 * ("<namespace>.<method>"), each with a written reason.
 *
 * Policy: default to exposing everything — this list is for
 * genuinely non-actionable methods only. test/coverage.ts asserts that every
 * method of every COVERED namespace is either a ToolDef.sdkRef or listed here.
 */
export const NOT_EXPOSED: Record<string, string> = {};

/**
 * Namespaces the manifest claims coverage for, DERIVED from the SDK references
 * actually used (tool `sdkRef`s + NOT_EXPOSED keys). A namespace becomes
 * "covered" — and thus audited by test/coverage.ts — the moment any of its
 * methods is mapped or explicitly skipped. No hand-maintained parallel list to
 * drift. Uncovered namespaces belong to groups not yet built.
 */
export const COVERED_NAMESPACES: readonly string[] = [
  ...new Set(
    [...ALL_TOOLS.map((t) => t.sdkRef), ...Object.keys(NOT_EXPOSED)].map((ref) => ref.split(".")[0]!),
  ),
];
