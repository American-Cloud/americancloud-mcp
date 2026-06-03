/**
 * Compute group: vms, vmPackages, images, regions, sshKeys.
 * Generated tool group — see CONTRIBUTING.md.
 */
import { z } from "zod";
import type { AmericancloudApi, AmericancloudApiClient } from "@americancloud/sdk";
import { defineTool, type ToolDef } from "../tooldef.js";
import { pagination } from "../schemas.js";

/**
 * For DTOs that are interface+namespace merged in the SDK (e.g. CreateVmDto
 * carries its SubscriptionPeriod const), `AmericancloudApi.X` resolves as a
 * value in type positions. Derive the request type from the client method
 * signature instead — works for every method, no name knowledge needed.
 */
type CreateVmDto = Parameters<AmericancloudApiClient["vms"]["createVms"]>[0];

// ---------------------------------------------------------------------------
// Local field builders (shared pagination lives in ../schemas.ts)
// ---------------------------------------------------------------------------
const vmId = z.string().describe("VM identifier (UUID), from list_vms or create_vm.");

const vmSpecs = z
  .object({
    vcpu: z.number().min(1).describe("Number of virtual CPUs."),
    memoryMb: z.number().int().min(512).describe("Memory in megabytes (e.g. 2048 for 2 GB)."),
    rootDiskGb: z.number().int().min(25).describe("Root disk size in gigabytes (minimum 25)."),
  })
  .describe(
    "VM size. Must be within the chosen package's limits (see list_vm_packages for min/max).",
  );

const networkAccess = z
  .object({
    allowEgressAll: z
      .boolean()
      .describe("Create an egress allow-all rule so the VM can reach the internet."),
    inboundPorts: z
      .array(
        z.object({
          port: z.number().int().min(1).max(65535).describe("Port to open."),
          protocol: z.enum(["TCP", "UDP"]).describe("Protocol."),
        }),
      )
      .optional()
      .describe("Inbound ports to open via port forwarding + firewall rules."),
    sourceCidr: z
      .string()
      .optional()
      .describe("Restrict inbound rules to this source CIDR (e.g. \"203.0.113.0/24\")."),
  })
  .optional()
  .describe(
    "Optional post-create network access configuration (egress + inbound rules on the network's public IP).",
  );

// ---------------------------------------------------------------------------
// vms — shapes
// ---------------------------------------------------------------------------
const listVmsShape = {
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListVmsRequest, z.ZodTypeAny>;

const createVmShape = {
  name: z.string().min(1).describe("VM name."),
  region: z.string().describe('Region label, e.g. "us-west-0" (from list_regions).'),
  vmPackage: z
    .string()
    .describe('VM package label, e.g. "standard-custom" (from list_vm_packages).'),
  vmSpecs,
  image: z
    .string()
    .describe('Image label, e.g. "ubuntu-24.04-050826" (from list_images).'),
  network: z
    .string()
    .describe(
      "UUID of an existing network to attach the VM to (from networking list tools).",
    ),
  subscriptionPeriod: z
    .enum(["hourly", "monthly"])
    .describe('Billing period: "hourly" (pay per hour) or "monthly".'),
  tags: z.array(z.string()).optional().describe("Tags to attach to the VM."),
  keypairs: z
    .array(z.string())
    .optional()
    .describe("Names of SSH key pairs to install (from list_ssh_keys)."),
  userdata: z
    .string()
    .optional()
    .describe("Base64-encoded cloud-init userdata script to run on first boot."),
  networkAccess,
} satisfies Record<keyof CreateVmDto, z.ZodTypeAny>;

type _CheckCreateVm =
  z.infer<z.ZodObject<typeof createVmShape>> extends CreateVmDto ? true : never;
const _checkCreateVm: _CheckCreateVm = true;
void _checkCreateVm;

const getVmShape = {
  id: vmId,
} satisfies Record<keyof AmericancloudApi.GetVmsRequest, z.ZodTypeAny>;

const deleteVmShape = {
  id: vmId,
} satisfies Record<keyof AmericancloudApi.DeleteVmsRequest, z.ZodTypeAny>;

const getVmMetricsShape = {
  id: vmId,
  hours: z.number().int().min(1).describe("How many hours of metrics history to return."),
  sample_period: z
    .number()
    .int()
    .optional()
    .describe("Sampling period in seconds. Omit for the API default."),
} satisfies Record<keyof AmericancloudApi.GetMetricsVmsRequest, z.ZodTypeAny>;

const resetVmPasswordShape = {
  id: vmId,
  password: z
    .string()
    .optional()
    .describe("New root/administrator password. Omit to have one generated and returned."),
} satisfies Record<keyof AmericancloudApi.ResetPasswordDto, z.ZodTypeAny>;

const powerVmShape = {
  id: vmId,
  action: z
    .enum(["start", "stop", "reboot"])
    .describe("Power action to perform."),
  force: z
    .boolean()
    .optional()
    .describe("Force the action without a graceful guest shutdown."),
} satisfies Record<keyof AmericancloudApi.PowerVmsRequest, z.ZodTypeAny>;

type _CheckPowerVm =
  z.infer<z.ZodObject<typeof powerVmShape>> extends AmericancloudApi.PowerVmsRequest
    ? true
    : never;
const _checkPowerVm: _CheckPowerVm = true;
void _checkPowerVm;

const scaleVmShape = {
  id: vmId,
  cpu: z.number().optional().describe("New vCPU count. Omit to keep current."),
  memoryMb: z
    .number()
    .int()
    .optional()
    .describe("New memory in megabytes. Omit to keep current."),
} satisfies Record<keyof AmericancloudApi.ScaleVmsRequest, z.ZodTypeAny>;

const resizeVmDiskShape = {
  id: vmId,
  sizeGb: z
    .number()
    .int()
    .describe("New root disk size in gigabytes. Disks can only grow, never shrink."),
  reboot: z
    .boolean()
    .optional()
    .describe("Reboot the VM to apply the resize immediately."),
} satisfies Record<keyof AmericancloudApi.ResizeVmDiskDto, z.ZodTypeAny>;

const createVmConsoleShape = {
  id: vmId,
} satisfies Record<keyof AmericancloudApi.CreateConsoleVmsRequest, z.ZodTypeAny>;

const updateVmHostnameShape = {
  id: vmId,
  hostname: z.string().min(1).describe("New hostname for the VM."),
} satisfies Record<keyof AmericancloudApi.UpdateHostnameVmsRequest, z.ZodTypeAny>;

const reinstallVmShape = {
  id: vmId,
  image: z
    .string()
    .optional()
    .describe("Image label to reinstall with (from list_images). Omit to reuse the current image."),
} satisfies Record<keyof AmericancloudApi.ReinstallVmsRequest, z.ZodTypeAny>;

// ---------------------------------------------------------------------------
// vmPackages / images / regions / sshKeys — shapes
// ---------------------------------------------------------------------------
const listVmPackagesShape = {
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListVmPackagesRequest, z.ZodTypeAny>;

const getVmPackageShape = {
  id: z.string().describe("VM package identifier (UUID), from list_vm_packages."),
} satisfies Record<keyof AmericancloudApi.GetVmPackagesRequest, z.ZodTypeAny>;

const getVmPackageByLabelShape = {
  label: z.string().describe('VM package label, e.g. "standard-custom".'),
} satisfies Record<keyof AmericancloudApi.GetByLabelVmPackagesRequest, z.ZodTypeAny>;

const listImagesShape = {
  os: z.string().optional().describe('Filter by operating system, e.g. "Ubuntu".'),
  version: z
    .string()
    .optional()
    .describe("Filter by OS version (used together with os)."),
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListImagesRequest, z.ZodTypeAny>;

const getImageShape = {
  id: z.string().describe("Image identifier (UUID), from list_images."),
} satisfies Record<keyof AmericancloudApi.GetImagesRequest, z.ZodTypeAny>;

const getImageByLabelShape = {
  label: z.string().describe('Image label, e.g. "ubuntu-24.04-050826".'),
} satisfies Record<keyof AmericancloudApi.GetByLabelImagesRequest, z.ZodTypeAny>;

const listRegionsShape = {
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListRegionsRequest, z.ZodTypeAny>;

const getRegionShape = {
  id: z.string().describe("Region identifier (UUID), from list_regions."),
} satisfies Record<keyof AmericancloudApi.GetRegionsRequest, z.ZodTypeAny>;

const getRegionByLabelShape = {
  label: z.string().describe('Region label, e.g. "us-west-0".'),
} satisfies Record<keyof AmericancloudApi.GetByLabelRegionsRequest, z.ZodTypeAny>;

const listSshKeysShape = {
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListSshKeysRequest, z.ZodTypeAny>;

const createSshKeyShape = {
  name: z.string().min(1).describe("Name for the SSH key pair."),
  publicKey: z
    .string()
    .optional()
    .describe(
      "Public key to register (OpenSSH format). Omit to have a key pair generated — the private key is returned once and never stored.",
    ),
} satisfies Record<keyof AmericancloudApi.CreateSshKeyDto, z.ZodTypeAny>;

const deleteSshKeyShape = {
  name: z.string().describe("Name of the SSH key pair to delete (from list_ssh_keys)."),
} satisfies Record<keyof AmericancloudApi.DeleteSshKeysRequest, z.ZodTypeAny>;

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------
export const computeTools: ToolDef[] = [
  // ── vms ──────────────────────────────────────────────────────────────────
  defineTool({
    name: "list_vms",
    title: "List VMs",
    description:
      "List the virtual machines in your American Cloud account, one page at a time, with their IDs, names, status, region, and IP addresses.",
    group: "compute",
    sdkRef: "vms.listVms",
    readOnly: true,
    idempotent: true,
    inputSchema: listVmsShape,
    run: (client, args) => client.vms.listVms(args),
  }),
  defineTool({
    name: "create_vm",
    title: "Create VM",
    description:
      "Create a new virtual machine. Billing starts immediately under the chosen subscriptionPeriod. Pick region, package, and image labels from list_regions, list_vm_packages, and list_images; preview pricing first with get_cost_estimate_vm. Returns the new VM — it provisions asynchronously (status CREATING → STARTED), so poll get_vm until it reaches STARTED.",
    group: "compute",
    sdkRef: "vms.createVms",
    readOnly: false,
    idempotent: false,
    inputSchema: createVmShape,
    run: (client, args) => client.vms.createVms(args),
  }),
  defineTool({
    name: "get_vm",
    title: "Get VM",
    description:
      "Get one virtual machine by ID: status, specs, IP address, network, and image details.",
    group: "compute",
    sdkRef: "vms.getVms",
    readOnly: true,
    idempotent: true,
    inputSchema: getVmShape,
    run: (client, args) => client.vms.getVms(args),
  }),
  defineTool({
    name: "delete_vm",
    title: "Delete VM",
    description:
      "Permanently destroy a virtual machine and its root disk. All data on the VM is lost and billing stops. Cannot be undone.",
    group: "compute",
    sdkRef: "vms.deleteVms",
    readOnly: false,
    destructive: true,
    idempotent: true,
    inputSchema: deleteVmShape,
    run: (client, args) => client.vms.deleteVms(args),
  }),
  defineTool({
    name: "get_vm_metrics",
    title: "Get VM metrics",
    description:
      "Get CPU, memory, network, and disk usage metrics for a VM over the last N hours.",
    group: "compute",
    sdkRef: "vms.getMetricsVms",
    readOnly: true,
    idempotent: true,
    inputSchema: getVmMetricsShape,
    run: (client, args) => client.vms.getMetricsVms(args),
  }),
  defineTool({
    name: "reset_vm_password",
    title: "Reset VM password",
    description:
      "Reset the root/administrator password of a VM. Provide a password to set it explicitly, or omit it to have one generated and returned in the response.",
    group: "compute",
    sdkRef: "vms.resetPasswordVms",
    readOnly: false,
    idempotent: false,
    inputSchema: resetVmPasswordShape,
    run: (client, args) => client.vms.resetPasswordVms(args),
  }),
  defineTool({
    name: "get_cost_estimate_vm",
    title: "Get VM cost estimate",
    description:
      "Preview the price of a VM configuration without creating anything. Takes the same arguments as create_vm and returns hourly/monthly cost breakdowns — use this before create_vm when cost matters.",
    group: "compute",
    sdkRef: "vms.getCostEstimateVms",
    readOnly: true,
    idempotent: true,
    inputSchema: createVmShape,
    run: (client, args) => client.vms.getCostEstimateVms(args),
  }),
  defineTool({
    name: "power_vm",
    title: "Power VM",
    description:
      "Start, stop, or reboot a virtual machine. Stop and reboot are disruptive but reversible; data is preserved. Stopped VMs keep their resources reserved.",
    group: "compute",
    sdkRef: "vms.powerVms",
    readOnly: false,
    idempotent: false,
    inputSchema: powerVmShape,
    run: (client, args) => client.vms.powerVms(args),
  }),
  defineTool({
    name: "scale_vm",
    title: "Scale VM",
    description:
      "Change a VM's vCPU count and/or memory. The new size must stay within the VM package limits (see list_vm_packages). May require a restart to take effect.",
    group: "compute",
    sdkRef: "vms.scaleVms",
    readOnly: false,
    idempotent: true,
    inputSchema: scaleVmShape,
    run: (client, args) => client.vms.scaleVms(args),
  }),
  defineTool({
    name: "resize_vm_disk",
    title: "Resize VM disk",
    description:
      "Grow a VM's root disk to a new size in GB. Disks can only be enlarged, never shrunk. Optionally reboot to apply immediately.",
    group: "compute",
    sdkRef: "vms.resizeDiskVms",
    readOnly: false,
    idempotent: true,
    inputSchema: resizeVmDiskShape,
    run: (client, args) => client.vms.resizeDiskVms(args),
  }),
  defineTool({
    name: "create_vm_console",
    title: "Create VM console session",
    description:
      "Create a browser-based console session for a VM and return its URL — useful when SSH is unavailable. The URL is short-lived; share it with the user promptly.",
    group: "compute",
    sdkRef: "vms.createConsoleVms",
    readOnly: false,
    idempotent: false,
    inputSchema: createVmConsoleShape,
    run: (client, args) => client.vms.createConsoleVms(args),
  }),
  defineTool({
    name: "update_vm_hostname",
    title: "Update VM hostname",
    description: "Change the hostname of a virtual machine.",
    group: "compute",
    sdkRef: "vms.updateHostnameVms",
    readOnly: false,
    idempotent: true,
    inputSchema: updateVmHostnameShape,
    run: (client, args) => client.vms.updateHostnameVms(args),
  }),
  defineTool({
    name: "reinstall_vm",
    title: "Reinstall VM",
    description:
      "Wipe a VM's root disk and reinstall the operating system, optionally from a different image. All data on the root disk is erased. The VM keeps its ID, network, and IP address.",
    group: "compute",
    sdkRef: "vms.reinstallVms",
    readOnly: false,
    destructive: true,
    idempotent: false,
    inputSchema: reinstallVmShape,
    run: (client, args) => client.vms.reinstallVms(args),
  }),

  // ── vmPackages ───────────────────────────────────────────────────────────
  defineTool({
    name: "list_vm_packages",
    title: "List VM packages",
    description:
      "List the available VM packages (compute tiers) with their labels, CPU/memory/disk limits, and zones. Package labels are required by create_vm and get_cost_estimate_vm.",
    group: "compute",
    sdkRef: "vmPackages.listVmPackages",
    readOnly: true,
    idempotent: true,
    inputSchema: listVmPackagesShape,
    run: (client, args) => client.vmPackages.listVmPackages(args),
  }),
  defineTool({
    name: "get_vm_package",
    title: "Get VM package",
    description: "Get one VM package by its UUID, including CPU/memory/disk limits.",
    group: "compute",
    sdkRef: "vmPackages.getVmPackages",
    readOnly: true,
    idempotent: true,
    inputSchema: getVmPackageShape,
    run: (client, args) => client.vmPackages.getVmPackages(args),
  }),
  defineTool({
    name: "get_vm_package_by_label",
    title: "Get VM package by label",
    description:
      'Get one VM package by its public label (e.g. "standard-custom"), including CPU/memory/disk limits.',
    group: "compute",
    sdkRef: "vmPackages.getByLabelVmPackages",
    readOnly: true,
    idempotent: true,
    inputSchema: getVmPackageByLabelShape,
    run: (client, args) => client.vmPackages.getByLabelVmPackages(args),
  }),

  // ── images ───────────────────────────────────────────────────────────────
  defineTool({
    name: "list_images",
    title: "List images",
    description:
      "List the operating system images available for VM creation, optionally filtered by OS and version. Image labels are required by create_vm and reinstall_vm.",
    group: "compute",
    sdkRef: "images.listImages",
    readOnly: true,
    idempotent: true,
    inputSchema: listImagesShape,
    run: (client, args) => client.images.listImages(args),
  }),
  defineTool({
    name: "get_image",
    title: "Get image",
    description:
      "Get one OS image by its UUID (from list_images), including its label and OS details.",
    group: "compute",
    sdkRef: "images.getImages",
    readOnly: true,
    idempotent: true,
    inputSchema: getImageShape,
    run: (client, args) => client.images.getImages(args),
  }),
  defineTool({
    name: "get_image_by_label",
    title: "Get image by label",
    description: 'Get one OS image by its public label (e.g. "ubuntu-24.04-050826").',
    group: "compute",
    sdkRef: "images.getByLabelImages",
    readOnly: true,
    idempotent: true,
    inputSchema: getImageByLabelShape,
    run: (client, args) => client.images.getByLabelImages(args),
  }),

  // ── regions ──────────────────────────────────────────────────────────────
  defineTool({
    name: "list_regions",
    title: "List regions",
    description:
      "List the regions where infrastructure can be provisioned. Region labels are required by create_vm and most create tools.",
    group: "compute",
    sdkRef: "regions.listRegions",
    readOnly: true,
    idempotent: true,
    inputSchema: listRegionsShape,
    run: (client, args) => client.regions.listRegions(args),
  }),
  defineTool({
    name: "get_region",
    title: "Get region",
    description:
      "Get one region by its UUID (from list_regions), including its label and availability.",
    group: "compute",
    sdkRef: "regions.getRegions",
    readOnly: true,
    idempotent: true,
    inputSchema: getRegionShape,
    run: (client, args) => client.regions.getRegions(args),
  }),
  defineTool({
    name: "get_region_by_label",
    title: "Get region by label",
    description: 'Get one region by its public label (e.g. "us-west-0").',
    group: "compute",
    sdkRef: "regions.getByLabelRegions",
    readOnly: true,
    idempotent: true,
    inputSchema: getRegionByLabelShape,
    run: (client, args) => client.regions.getByLabelRegions(args),
  }),

  // ── sshKeys ──────────────────────────────────────────────────────────────
  defineTool({
    name: "list_ssh_keys",
    title: "List SSH keys",
    description:
      "List the SSH key pairs registered in your account. Key names are used by create_vm's keypairs argument.",
    group: "compute",
    sdkRef: "sshKeys.listSshKeys",
    readOnly: true,
    idempotent: true,
    inputSchema: listSshKeysShape,
    run: (client, args) => client.sshKeys.listSshKeys(args),
  }),
  defineTool({
    name: "create_ssh_key",
    title: "Create SSH key",
    description:
      "Register an SSH key pair. Provide publicKey to register an existing key, or omit it to have a pair generated — the private key is returned once in the response and never stored.",
    group: "compute",
    sdkRef: "sshKeys.createSshKeys",
    readOnly: false,
    idempotent: false,
    inputSchema: createSshKeyShape,
    run: (client, args) => client.sshKeys.createSshKeys(args),
  }),
  defineTool({
    name: "delete_ssh_key",
    title: "Delete SSH key",
    description:
      "Delete an SSH key pair from your account by name. Existing VMs keep any installed keys; this only removes the stored pair. Cannot be undone.",
    group: "compute",
    sdkRef: "sshKeys.deleteSshKeys",
    readOnly: false,
    destructive: true,
    idempotent: true,
    inputSchema: deleteSshKeyShape,
    run: (client, args) => client.sshKeys.deleteSshKeys(args),
  }),
];
