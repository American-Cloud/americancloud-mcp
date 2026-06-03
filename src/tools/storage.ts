/**
 * Storage group: blockStorage, snapshots, objectStorage.
 */
import { z } from "zod";
import type { AmericancloudApi, AmericancloudApiClient } from "@americancloud/sdk";
import { defineTool, type ToolDef } from "../tooldef.js";
import { pagination } from "../schemas.js";

// CreateSnapshotDto is interface+namespace merged (carries the type enum).
type CreateSnapshotDto = Parameters<AmericancloudApiClient["snapshots"]["createSnapshots"]>[0];

// ── blockStorage shapes ────────────────────────────────────────────────────
const listBlockStorageShape = {
  vmId: z.string().optional().describe("Filter to volumes attached to this VM (UUID)."),
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListBlockStorageRequest, z.ZodTypeAny>;

const createBlockStorageShape = {
  name: z.string().min(1).describe("Volume name."),
  sizeGb: z.number().int().min(1).describe("Volume size in gigabytes."),
  region: z.string().describe('Region label, e.g. "us-west-0" (from list_regions).'),
} satisfies Record<keyof AmericancloudApi.CreateVolumeDto, z.ZodTypeAny>;

const getBlockStorageShape = {
  id: z.string().describe("Block storage volume identifier (UUID), from list_block_storage_volumes."),
} satisfies Record<keyof AmericancloudApi.GetBlockStorageRequest, z.ZodTypeAny>;

const deleteBlockStorageShape = {
  id: z.string().describe("Volume identifier (UUID) to delete."),
} satisfies Record<keyof AmericancloudApi.DeleteBlockStorageRequest, z.ZodTypeAny>;

const attachBlockStorageShape = {
  id: z.string().describe("Volume identifier (UUID) to attach."),
  vmId: z.string().describe("VM identifier (UUID) to attach the volume to (from list_vms)."),
} satisfies Record<keyof AmericancloudApi.AttachVolumeDto, z.ZodTypeAny>;

const detachBlockStorageShape = {
  id: z.string().describe("Volume identifier (UUID) to detach from its VM."),
} satisfies Record<keyof AmericancloudApi.DetachBlockStorageRequest, z.ZodTypeAny>;

const resizeBlockStorageShape = {
  id: z.string().describe("Volume identifier (UUID) to resize."),
  sizeGb: z.number().int().describe("New size in gigabytes. Volumes can only grow, never shrink."),
} satisfies Record<keyof AmericancloudApi.ResizeVolumeDto, z.ZodTypeAny>;

const listBlockStorageSnapshotsShape = {
  id: z.string().describe("Volume identifier (UUID) whose snapshots to list."),
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListSnapshotsBlockStorageRequest, z.ZodTypeAny>;

// ── snapshots shapes ───────────────────────────────────────────────────────
const listSnapshotsShape = {
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListSnapshotsRequest, z.ZodTypeAny>;

const createSnapshotShape = {
  volumeId: z.string().describe("Volume identifier (UUID) to snapshot (from list_block_storage_volumes)."),
  name: z.string().min(1).describe("Snapshot name."),
  type: z
    .enum(["DataDisk", "RootDisk"])
    .describe("Whether the snapshot is of a data-disk volume or a VM root disk."),
} satisfies Record<keyof CreateSnapshotDto, z.ZodTypeAny>;

type _CheckCreateSnapshot =
  z.infer<z.ZodObject<typeof createSnapshotShape>> extends CreateSnapshotDto ? true : never;
const _checkCreateSnapshot: _CheckCreateSnapshot = true;
void _checkCreateSnapshot;

const getSnapshotShape = {
  id: z.string().describe("Snapshot identifier (UUID), from list_snapshots."),
} satisfies Record<keyof AmericancloudApi.GetSnapshotsRequest, z.ZodTypeAny>;

const deleteSnapshotShape = {
  id: z.string().describe("Snapshot identifier (UUID) to delete."),
} satisfies Record<keyof AmericancloudApi.DeleteSnapshotsRequest, z.ZodTypeAny>;

const revertSnapshotShape = {
  id: z.string().describe("Snapshot identifier (UUID) to revert its volume to."),
} satisfies Record<keyof AmericancloudApi.RevertSnapshotsRequest, z.ZodTypeAny>;

// ── objectStorage shapes ───────────────────────────────────────────────────
const listObjectStorageUnitsShape = {
  usage: z.boolean().optional().describe("Include current usage figures in the response."),
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListUnitsObjectStorageRequest, z.ZodTypeAny>;

const createObjectStorageUnitShape = {
  name: z.string().min(1).describe("Storage unit name."),
} satisfies Record<keyof AmericancloudApi.CreateStorageUnitRequestDto, z.ZodTypeAny>;

const listObjectStorageBucketsShape = {
  storageUnitId: z.string().describe("Storage unit identifier (UUID), from list_object_storage_units."),
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListBucketsObjectStorageRequest, z.ZodTypeAny>;

const createObjectStorageBucketShape = {
  storageUnitId: z.string().describe("Storage unit identifier (UUID) to create the bucket in."),
  name: z.string().min(1).describe("Bucket name (must be unique within the unit)."),
} satisfies Record<keyof AmericancloudApi.CreateBucketRequestDto, z.ZodTypeAny>;

const getObjectStorageKeysShape = {
  storageUnitId: z.string().describe("Storage unit identifier (UUID) whose S3 access keys to return."),
} satisfies Record<keyof AmericancloudApi.GetKeysObjectStorageRequest, z.ZodTypeAny>;

const setObjectStorageQuotaShape = {
  storageUnitId: z.string().describe("Storage unit identifier (UUID) to set the quota on."),
  maxSizeGb: z.number().int().optional().describe("Maximum size in gigabytes. Omit when removing the limit."),
  removeLimit: z.boolean().optional().describe("Set true to remove any size limit (unlimited)."),
} satisfies Record<keyof AmericancloudApi.SetUserQuotaRequestDto, z.ZodTypeAny>;

const deleteObjectStorageUnitShape = {
  storageUnitId: z.string().describe("Storage unit identifier (UUID) to delete."),
} satisfies Record<keyof AmericancloudApi.DeleteUnitObjectStorageRequest, z.ZodTypeAny>;

const deleteObjectStorageBucketShape = {
  storageUnitId: z.string().describe("Storage unit identifier (UUID) containing the bucket."),
  bucketName: z.string().describe("Name of the bucket to delete."),
  purgeObjects: z
    .boolean()
    .optional()
    .describe("Set true to delete the bucket even if it contains objects (purges them)."),
} satisfies Record<keyof AmericancloudApi.DeleteBucketObjectStorageRequest, z.ZodTypeAny>;

export const storageTools: ToolDef[] = [
  // ── blockStorage ──
  defineTool({
    name: "list_block_storage_volumes",
    title: "List block storage volumes",
    description:
      "List block storage volumes in your account, optionally filtered to a VM. Returns IDs, sizes, regions, and attachment state.",
    group: "storage",
    sdkRef: "blockStorage.listBlockStorage",
    readOnly: true,
    idempotent: true,
    inputSchema: listBlockStorageShape,
    run: (client, args) => client.blockStorage.listBlockStorage(args),
  }),
  defineTool({
    name: "create_block_storage_volume",
    title: "Create block storage volume",
    description:
      "Create a block storage volume in a region. Attach it to a VM afterward with attach_block_storage_volume. Preview cost with get_cost_estimate_block_storage.",
    group: "storage",
    sdkRef: "blockStorage.createBlockStorage",
    readOnly: false,
    idempotent: false,
    inputSchema: createBlockStorageShape,
    run: (client, args) => client.blockStorage.createBlockStorage(args),
  }),
  defineTool({
    name: "get_block_storage_volume",
    title: "Get block storage volume",
    description: "Get one block storage volume by ID: size, region, and attachment state.",
    group: "storage",
    sdkRef: "blockStorage.getBlockStorage",
    readOnly: true,
    idempotent: true,
    inputSchema: getBlockStorageShape,
    run: (client, args) => client.blockStorage.getBlockStorage(args),
  }),
  defineTool({
    name: "delete_block_storage_volume",
    title: "Delete block storage volume",
    description:
      "Permanently delete a block storage volume and all data on it. Detach it from any VM first. Cannot be undone.",
    group: "storage",
    sdkRef: "blockStorage.deleteBlockStorage",
    readOnly: false,
    destructive: true,
    idempotent: true,
    inputSchema: deleteBlockStorageShape,
    run: (client, args) => client.blockStorage.deleteBlockStorage(args),
  }),
  defineTool({
    name: "get_cost_estimate_block_storage",
    title: "Get block storage cost estimate",
    description:
      "Preview the price of a block storage volume configuration without creating it. Takes the same arguments as create_block_storage_volume.",
    group: "storage",
    sdkRef: "blockStorage.getCostEstimateBlockStorage",
    readOnly: true,
    idempotent: true,
    inputSchema: createBlockStorageShape,
    run: (client, args) => client.blockStorage.getCostEstimateBlockStorage(args),
  }),
  defineTool({
    name: "attach_block_storage_volume",
    title: "Attach block storage volume",
    description: "Attach a block storage volume to a VM. The volume and VM must be in the same region.",
    group: "storage",
    sdkRef: "blockStorage.attachBlockStorage",
    readOnly: false,
    idempotent: true,
    inputSchema: attachBlockStorageShape,
    run: (client, args) => client.blockStorage.attachBlockStorage(args),
  }),
  defineTool({
    name: "detach_block_storage_volume",
    title: "Detach block storage volume",
    description: "Detach a block storage volume from whatever VM it is attached to. Data is preserved.",
    group: "storage",
    sdkRef: "blockStorage.detachBlockStorage",
    readOnly: false,
    idempotent: true,
    inputSchema: detachBlockStorageShape,
    run: (client, args) => client.blockStorage.detachBlockStorage(args),
  }),
  defineTool({
    name: "resize_block_storage_volume",
    title: "Resize block storage volume",
    description: "Grow a block storage volume to a new size in GB. Volumes can only be enlarged, never shrunk.",
    group: "storage",
    sdkRef: "blockStorage.resizeBlockStorage",
    readOnly: false,
    idempotent: true,
    inputSchema: resizeBlockStorageShape,
    run: (client, args) => client.blockStorage.resizeBlockStorage(args),
  }),
  defineTool({
    name: "list_block_storage_snapshots",
    title: "List block storage snapshots",
    description: "List the snapshots taken of a specific block storage volume.",
    group: "storage",
    sdkRef: "blockStorage.listSnapshotsBlockStorage",
    readOnly: true,
    idempotent: true,
    inputSchema: listBlockStorageSnapshotsShape,
    run: (client, args) => client.blockStorage.listSnapshotsBlockStorage(args),
  }),

  // ── snapshots ──
  defineTool({
    name: "list_snapshots",
    title: "List snapshots",
    description: "List all volume snapshots in your account with their IDs, source volumes, and types.",
    group: "storage",
    sdkRef: "snapshots.listSnapshots",
    readOnly: true,
    idempotent: true,
    inputSchema: listSnapshotsShape,
    run: (client, args) => client.snapshots.listSnapshots(args),
  }),
  defineTool({
    name: "create_snapshot",
    title: "Create snapshot",
    description:
      "Take a point-in-time snapshot of a volume (data disk or VM root disk). Restore it later with revert_snapshot.",
    group: "storage",
    sdkRef: "snapshots.createSnapshots",
    readOnly: false,
    idempotent: false,
    inputSchema: createSnapshotShape,
    run: (client, args) => client.snapshots.createSnapshots(args),
  }),
  defineTool({
    name: "get_snapshot",
    title: "Get snapshot",
    description: "Get one snapshot by ID: source volume, type, size, and creation time.",
    group: "storage",
    sdkRef: "snapshots.getSnapshots",
    readOnly: true,
    idempotent: true,
    inputSchema: getSnapshotShape,
    run: (client, args) => client.snapshots.getSnapshots(args),
  }),
  defineTool({
    name: "delete_snapshot",
    title: "Delete snapshot",
    description: "Permanently delete a snapshot. The source volume is unaffected. Cannot be undone.",
    group: "storage",
    sdkRef: "snapshots.deleteSnapshots",
    readOnly: false,
    destructive: true,
    idempotent: true,
    inputSchema: deleteSnapshotShape,
    run: (client, args) => client.snapshots.deleteSnapshots(args),
  }),
  defineTool({
    name: "get_cost_estimate_snapshot",
    title: "Get snapshot cost estimate",
    description:
      "Preview the price of a snapshot without creating it. Takes the same arguments as create_snapshot.",
    group: "storage",
    sdkRef: "snapshots.getCostEstimateSnapshots",
    readOnly: true,
    idempotent: true,
    inputSchema: createSnapshotShape,
    run: (client, args) => client.snapshots.getCostEstimateSnapshots(args),
  }),
  defineTool({
    name: "revert_snapshot",
    title: "Revert snapshot",
    description:
      "Restore a volume to the state captured in a snapshot. All changes made to the volume since the snapshot are overwritten and lost. Cannot be undone.",
    group: "storage",
    sdkRef: "snapshots.revertSnapshots",
    readOnly: false,
    destructive: true,
    idempotent: true,
    inputSchema: revertSnapshotShape,
    run: (client, args) => client.snapshots.revertSnapshots(args),
  }),

  // ── objectStorage ──
  defineTool({
    name: "list_object_storage_units",
    title: "List object storage units",
    description:
      "List your S3-compatible object storage units, optionally with usage figures. A unit contains buckets and has its own access keys.",
    group: "storage",
    sdkRef: "objectStorage.listUnitsObjectStorage",
    readOnly: true,
    idempotent: true,
    inputSchema: listObjectStorageUnitsShape,
    run: (client, args) => client.objectStorage.listUnitsObjectStorage(args),
  }),
  defineTool({
    name: "create_object_storage_unit",
    title: "Create object storage unit",
    description:
      "Create an S3-compatible object storage unit. Buckets and access keys live inside it. Object storage is metered by usage.",
    group: "storage",
    sdkRef: "objectStorage.createUnitObjectStorage",
    readOnly: false,
    idempotent: false,
    inputSchema: createObjectStorageUnitShape,
    run: (client, args) => client.objectStorage.createUnitObjectStorage(args),
  }),
  defineTool({
    name: "list_object_storage_buckets",
    title: "List object storage buckets",
    description: "List the buckets within an object storage unit.",
    group: "storage",
    sdkRef: "objectStorage.listBucketsObjectStorage",
    readOnly: true,
    idempotent: true,
    inputSchema: listObjectStorageBucketsShape,
    run: (client, args) => client.objectStorage.listBucketsObjectStorage(args),
  }),
  defineTool({
    name: "create_object_storage_bucket",
    title: "Create object storage bucket",
    description: "Create a bucket within an object storage unit (from list_object_storage_units).",
    group: "storage",
    sdkRef: "objectStorage.createBucketObjectStorage",
    readOnly: false,
    idempotent: false,
    inputSchema: createObjectStorageBucketShape,
    run: (client, args) => client.objectStorage.createBucketObjectStorage(args),
  }),
  defineTool({
    name: "get_object_storage_keys",
    title: "Get object storage keys",
    description:
      "Get the S3 access key and secret for an object storage unit, used to connect S3 clients. Treat the returned secret as sensitive.",
    group: "storage",
    sdkRef: "objectStorage.getKeysObjectStorage",
    readOnly: true,
    idempotent: true,
    inputSchema: getObjectStorageKeysShape,
    run: (client, args) => client.objectStorage.getKeysObjectStorage(args),
  }),
  defineTool({
    name: "get_cost_estimate_object_storage",
    title: "Get object storage cost estimate",
    description:
      "Get the metered pricing for object storage (per-GB rate and minimums). Takes no arguments — object storage is billed by actual usage.",
    group: "storage",
    sdkRef: "objectStorage.getCostEstimateObjectStorage",
    readOnly: true,
    idempotent: true,
    inputSchema: {},
    run: (client) => client.objectStorage.getCostEstimateObjectStorage(),
  }),
  defineTool({
    name: "set_object_storage_quota",
    title: "Set object storage quota",
    description:
      "Set or remove the maximum size for an object storage unit. Provide maxSizeGb to cap it, or removeLimit=true for unlimited.",
    group: "storage",
    sdkRef: "objectStorage.setUserQuotaObjectStorage",
    readOnly: false,
    idempotent: true,
    inputSchema: setObjectStorageQuotaShape,
    run: (client, args) => client.objectStorage.setUserQuotaObjectStorage(args),
  }),
  defineTool({
    name: "delete_object_storage_unit",
    title: "Delete object storage unit",
    description:
      "Permanently delete an object storage unit, its buckets, and all objects. Cannot be undone.",
    group: "storage",
    sdkRef: "objectStorage.deleteUnitObjectStorage",
    readOnly: false,
    destructive: true,
    idempotent: true,
    inputSchema: deleteObjectStorageUnitShape,
    run: (client, args) => client.objectStorage.deleteUnitObjectStorage(args),
  }),
  defineTool({
    name: "delete_object_storage_bucket",
    title: "Delete object storage bucket",
    description:
      "Permanently delete a bucket. By default fails if the bucket is non-empty; pass purgeObjects=true to delete it and all its objects. Cannot be undone.",
    group: "storage",
    sdkRef: "objectStorage.deleteBucketObjectStorage",
    readOnly: false,
    destructive: true,
    idempotent: true,
    inputSchema: deleteObjectStorageBucketShape,
    run: (client, args) => client.objectStorage.deleteBucketObjectStorage(args),
  }),
];
