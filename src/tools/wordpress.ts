/**
 * WordPress group. Most operations act on the account's single managed
 * WordPress subscription and take no arguments.
 */
import { z } from "zod";
import type { AmericancloudApi } from "@americancloud/sdk";
import { defineTool, type ToolDef } from "../tooldef.js";
import { pagination } from "../schemas.js";

const createWordpressShape = {
  packageLabel: z.string().describe("WordPress package label (from list_wordpress_packages)."),
  domain: z
    .string()
    .optional()
    .describe(
      "Optional custom domain for the site, e.g. \"example.com\". Point it at the nameservers from get_wordpress_nameservers.",
    ),
} satisfies Record<keyof AmericancloudApi.CreateWordPressDto, z.ZodTypeAny>;

type _CheckCreateWp =
  z.infer<z.ZodObject<typeof createWordpressShape>> extends AmericancloudApi.CreateWordPressDto ? true : never;
const _checkCreateWp: _CheckCreateWp = true;
void _checkCreateWp;

const updateWordpressPasswordShape = {
  newPassword: z.string().min(1).describe("New WordPress admin password."),
} satisfies Record<keyof AmericancloudApi.UpdatePasswordDto, z.ZodTypeAny>;

const changeWordpressPackageShape = {
  packageLabel: z.string().describe("New WordPress package label (from list_wordpress_upgrade_packages)."),
} satisfies Record<keyof AmericancloudApi.ChangePackageDto, z.ZodTypeAny>;

const listWordpressPackagesShape = {
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListPackagesWordpressRequest, z.ZodTypeAny>;

const listWordpressUpgradePackagesShape = {
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListUpgradePackagesWordpressRequest, z.ZodTypeAny>;

export const wordpressTools: ToolDef[] = [
  defineTool({
    name: "get_wordpress",
    title: "Get WordPress site",
    description: "Get the account's managed WordPress subscription: status, package, domain, and details.",
    group: "wordpress",
    sdkRef: "wordpress.getWordpress",
    readOnly: true,
    idempotent: true,
    inputSchema: {},
    run: (client) => client.wordpress.getWordpress(),
  }),
  defineTool({
    name: "create_wordpress",
    title: "Create WordPress site",
    description:
      "Provision a managed WordPress site on the chosen package. The call returns as soon as the request is accepted, with the new site's id and a status of provisioning — poll get_wordpress until it reports active, or failed with a reason. Preview cost first with get_cost_estimate_wordpress.",
    group: "wordpress",
    sdkRef: "wordpress.createWordpress",
    readOnly: false,
    idempotent: false,
    inputSchema: createWordpressShape,
    run: (client, args) => client.wordpress.createWordpress(args),
  }),
  defineTool({
    name: "cancel_wordpress",
    title: "Cancel WordPress site",
    description:
      "Cancel and tear down the managed WordPress subscription. The site and its content are removed. Cannot be undone.",
    group: "wordpress",
    sdkRef: "wordpress.cancelWordpress",
    readOnly: false,
    destructive: true,
    idempotent: true,
    inputSchema: {},
    run: (client) => client.wordpress.cancelWordpress(),
  }),
  defineTool({
    name: "get_cost_estimate_wordpress",
    title: "Get WordPress cost estimate",
    description:
      "Preview the price of a WordPress configuration without creating it. Takes the same arguments as create_wordpress.",
    group: "wordpress",
    sdkRef: "wordpress.getCostEstimateWordpress",
    readOnly: true,
    idempotent: true,
    inputSchema: createWordpressShape,
    run: (client, args) => client.wordpress.getCostEstimateWordpress(args),
  }),
  defineTool({
    name: "update_wordpress_password",
    title: "Update WordPress password",
    description: "Set a new admin password for the managed WordPress site.",
    group: "wordpress",
    sdkRef: "wordpress.updatePasswordWordpress",
    readOnly: false,
    idempotent: true,
    inputSchema: updateWordpressPasswordShape,
    run: (client, args) => client.wordpress.updatePasswordWordpress(args),
  }),
  defineTool({
    name: "create_wordpress_session",
    title: "Create WordPress admin session",
    description:
      "Create an authenticated admin login session and return a one-time URL that opens the WordPress dashboard signed in. The URL is short-lived.",
    group: "wordpress",
    sdkRef: "wordpress.createSessionWordpress",
    readOnly: false,
    idempotent: false,
    inputSchema: {},
    run: (client) => client.wordpress.createSessionWordpress(),
  }),
  defineTool({
    name: "get_wordpress_quota",
    title: "Get WordPress quota",
    description: "Get the storage/resource quota and current usage for the managed WordPress site.",
    group: "wordpress",
    sdkRef: "wordpress.getQuotaWordpress",
    readOnly: true,
    idempotent: true,
    inputSchema: {},
    run: (client) => client.wordpress.getQuotaWordpress(),
  }),
  defineTool({
    name: "get_wordpress_max_instances",
    title: "Get WordPress max instances",
    description: "Get the maximum number of WordPress instances allowed for the account.",
    group: "wordpress",
    sdkRef: "wordpress.getMaxInstancesWordpress",
    readOnly: true,
    idempotent: true,
    inputSchema: {},
    run: (client) => client.wordpress.getMaxInstancesWordpress(),
  }),
  defineTool({
    name: "list_wordpress_websites",
    title: "List WordPress websites",
    description: "List the websites hosted under the managed WordPress subscription.",
    group: "wordpress",
    sdkRef: "wordpress.listWebsitesWordpress",
    readOnly: true,
    idempotent: true,
    inputSchema: {},
    run: (client) => client.wordpress.listWebsitesWordpress(),
  }),
  defineTool({
    name: "get_wordpress_bandwidth",
    title: "Get WordPress bandwidth",
    description: "Get bandwidth usage figures for the managed WordPress site.",
    group: "wordpress",
    sdkRef: "wordpress.getBandwidthWordpress",
    readOnly: true,
    idempotent: true,
    inputSchema: {},
    run: (client) => client.wordpress.getBandwidthWordpress(),
  }),
  defineTool({
    name: "get_wordpress_nameservers",
    title: "Get WordPress nameservers",
    description: "Get the nameservers to point a domain at for the managed WordPress site.",
    group: "wordpress",
    sdkRef: "wordpress.getNameserversWordpress",
    readOnly: true,
    idempotent: true,
    inputSchema: {},
    run: (client) => client.wordpress.getNameserversWordpress(),
  }),
  defineTool({
    name: "change_wordpress_package",
    title: "Change WordPress package",
    description:
      "Change the managed WordPress site to a different package. Use list_wordpress_upgrade_packages for valid targets, and preview the charge with get_wordpress_change_package_estimate.",
    group: "wordpress",
    sdkRef: "wordpress.changePackageWordpress",
    readOnly: false,
    idempotent: true,
    inputSchema: changeWordpressPackageShape,
    run: (client, args) => client.wordpress.changePackageWordpress(args),
  }),
  defineTool({
    name: "get_wordpress_change_package_estimate",
    title: "Get WordPress package change estimate",
    description:
      "Preview what it costs to move the managed WordPress site to another package. Returns the prorated charge for the rest of the current billing period, the difference in monthly rate, any account discount, and the period the charge covers. It changes nothing and charges nothing; use list_wordpress_upgrade_packages for valid targets.",
    group: "wordpress",
    sdkRef: "wordpress.getChangePackageEstimateWordpress",
    readOnly: true,
    idempotent: true,
    inputSchema: changeWordpressPackageShape,
    run: (client, args) => client.wordpress.getChangePackageEstimateWordpress(args),
  }),
  defineTool({
    name: "list_wordpress_packages",
    title: "List WordPress packages",
    description: "List the available WordPress packages (tiers) for site creation.",
    group: "wordpress",
    sdkRef: "wordpress.listPackagesWordpress",
    readOnly: true,
    idempotent: true,
    inputSchema: listWordpressPackagesShape,
    run: (client, args) => client.wordpress.listPackagesWordpress(args),
  }),
  defineTool({
    name: "get_current_wordpress_package",
    title: "Get current WordPress package",
    description: "Get the package the managed WordPress site is currently on.",
    group: "wordpress",
    sdkRef: "wordpress.getCurrentPackageWordpress",
    readOnly: true,
    idempotent: true,
    inputSchema: {},
    run: (client) => client.wordpress.getCurrentPackageWordpress(),
  }),
  defineTool({
    name: "list_wordpress_upgrade_packages",
    title: "List WordPress upgrade packages",
    description: "List the packages the current WordPress site can change to (valid targets for change_wordpress_package).",
    group: "wordpress",
    sdkRef: "wordpress.listUpgradePackagesWordpress",
    readOnly: true,
    idempotent: true,
    inputSchema: listWordpressUpgradePackagesShape,
    run: (client, args) => client.wordpress.listUpgradePackagesWordpress(args),
  }),
];
