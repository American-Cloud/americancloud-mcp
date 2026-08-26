/**
 * Databases group: databases, databaseBackups, databaseInfrastructure,
 * databaseOfferings, databaseRegions, databaseOperations.
 *
 * Note the two distinct "load balancer" concepts: tools here are
 * *_database_load_balancer (a managed-DB connection LB); networking's
 * *_load_balancer_rule are public-IP load balancer rules.
 */
import { z } from "zod";
import type { AmericancloudApi, AmericancloudApiClient } from "@americancloud/sdk";
import { defineTool, type ToolDef } from "../tooldef.js";
import { pagination } from "../schemas.js";

// Merged DTOs (carry enum/array namespaces) — derive from method signatures.
type CreateDatabaseClusterDto = Parameters<AmericancloudApiClient["databases"]["createDatabases"]>[0];
type TriggerBackupRequestDto = Parameters<AmericancloudApiClient["databaseBackups"]["triggerDatabaseBackups"]>[0];

const clusterId = z.string().describe("Database cluster identifier (UUID), from list_databases.");
const lbType = z.enum(["public", "private"]).describe("Load balancer type.");

// ── databases ──────────────────────────────────────────────────────────────
const listDatabasesShape = {
  user_cluster_id: z.string().optional().describe("Filter to a specific user cluster ID."),
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListDatabasesRequest, z.ZodTypeAny>;

const createDatabaseShape = {
  userClusterId: z.string().optional().describe("Optional caller-supplied cluster ID."),
  dbClusterName: z.string().min(1).describe("Database cluster name."),
  sshKey: z.string().optional().describe("SSH key pair name for node access (from list_ssh_keys)."),
  offeringId: z.string().optional().describe("Offering ID (from list_database_offerings). Provide offeringId or offeringName."),
  offeringName: z.string().optional().describe("Offering name, as an alternative to offeringId."),
  regionId: z.string().describe("Database region ID (from list_database_regions)."),
  tier: z.string().describe("Service tier."),
  availabilityType: z
    .enum(["single-node", "data-redundancy"])
    .describe("single-node (one instance) or data-redundancy (replicated)."),
  storageGb: z.number().int().optional().describe("Storage size in gigabytes."),
  networkConfig: z
    .any()
    .optional()
    .describe(
      "Advanced network placement (isolated or VPC) with a networkType discriminator. Omit to use defaults.",
    ),
  restore: z
    .object({
      sourceClusterId: z.string().describe("Cluster ID to restore from."),
      backupName: z.string().describe("Backup name to restore."),
      restorePointInTime: z.string().optional().describe("Optional point-in-time to restore to (ISO timestamp)."),
    })
    .optional()
    .describe("Optionally create the cluster by restoring from an existing backup."),
} satisfies Record<keyof CreateDatabaseClusterDto, z.ZodTypeAny>;
type _CkCreateDb = z.infer<z.ZodObject<typeof createDatabaseShape>> extends CreateDatabaseClusterDto ? true : never;
const _ckCreateDb: _CkCreateDb = true;
void _ckCreateDb;

const getCostEstimateDatabaseShape = {
  offeringId: z.string().describe("Offering ID to price (from list_database_offerings)."),
  user_cluster_id: z.string().optional().describe("Existing user cluster ID, for resize estimates."),
  availability_type: z.string().optional().describe("Availability type (single-node / data-redundancy)."),
  storage_gb: z.string().optional().describe("Storage size in GB (string)."),
  tier: z.string().optional().describe("Service tier."),
  db_cluster_id: z.string().optional().describe("Existing DB cluster ID, for resize estimates."),
} satisfies Record<keyof AmericancloudApi.GetCostEstimateDatabasesRequest, z.ZodTypeAny>;

const getDatabaseShape = {
  clusterId,
} satisfies Record<keyof AmericancloudApi.GetDatabasesRequest, z.ZodTypeAny>;
const deleteDatabaseShape = {
  clusterId,
} satisfies Record<keyof AmericancloudApi.DeleteDatabasesRequest, z.ZodTypeAny>;
const getDatabaseStatusShape = {
  clusterId,
} satisfies Record<keyof AmericancloudApi.GetStatusDatabasesRequest, z.ZodTypeAny>;
const getDatabaseConnectionShape = {
  clusterId,
  includePassword: z.string().describe('Whether to include the password in the response ("true"/"false").'),
} satisfies Record<keyof AmericancloudApi.GetConnectionDatabasesRequest, z.ZodTypeAny>;
const getDatabaseOperationsShape = {
  clusterId,
} satisfies Record<keyof AmericancloudApi.GetOperationsDatabasesRequest, z.ZodTypeAny>;
const startDatabaseShape = {
  clusterId,
} satisfies Record<keyof AmericancloudApi.StartDatabasesRequest, z.ZodTypeAny>;
const stopDatabaseShape = {
  clusterId,
} satisfies Record<keyof AmericancloudApi.StopDatabasesRequest, z.ZodTypeAny>;
const resizeDatabaseShape = {
  clusterId,
  offeringId: z.string().describe("New offering ID (from list_database_offerings)."),
  storageGb: z.number().int().optional().describe("New storage size in gigabytes (can only grow)."),
} satisfies Record<keyof AmericancloudApi.ResizeDatabaseClusterDto, z.ZodTypeAny>;
const modifyDatabaseLoadBalancerShape = {
  clusterId,
  type: lbType,
  cidr: z.string().optional().describe("Allowed CIDR for the load balancer."),
  loadBalancerIP: z.string().optional().describe("Specific load balancer IP to use."),
} satisfies Record<keyof AmericancloudApi.ModifyLoadBalancerRequestDto, z.ZodTypeAny>;
const deleteDatabaseLoadBalancerShape = {
  clusterId,
  type: lbType,
} satisfies Record<keyof AmericancloudApi.DeleteLoadBalancerDatabasesRequest, z.ZodTypeAny>;

// ── databaseBackups ────────────────────────────────────────────────────────
const BACKUP_METHODS = ["xtrabackup", "pg-basebackup", "datafile"] as const;
const setActiveDatabaseBackupRepoShape = {
  clusterId,
  repoName: z.string().describe("Backup repository name to make active."),
} satisfies Record<keyof AmericancloudApi.SetActiveBackupRepoRequestDto, z.ZodTypeAny>;
const listDatabaseBackupsShape = {
  clusterId,
} satisfies Record<keyof AmericancloudApi.ListDatabaseBackupsRequest, z.ZodTypeAny>;
const triggerDatabaseBackupShape = {
  clusterId,
  backupMethod: z.enum(BACKUP_METHODS).describe("Backup engine to use."),
  backupPolicyName: z.string().describe("Backup policy name."),
  backupName: z.string().describe("Name for the new backup."),
  retentionPeriod: z.string().describe("How long to retain the backup (e.g. a duration string)."),
  deletionPolicy: z.enum(["Delete", "Retain"]).describe("What happens to the backup data on deletion."),
} satisfies Record<keyof TriggerBackupRequestDto, z.ZodTypeAny>;
type _CkTrig = z.infer<z.ZodObject<typeof triggerDatabaseBackupShape>> extends TriggerBackupRequestDto ? true : never;
const _ckTrig: _CkTrig = true;
void _ckTrig;
const getDatabaseBackupConfigShape = {
  clusterId,
} satisfies Record<keyof AmericancloudApi.GetConfigDatabaseBackupsRequest, z.ZodTypeAny>;
const updateDatabaseBackupConfigShape = {
  clusterId,
  encryptionEnabled: z
    .boolean()
    .describe(
      "Whether backups for this cluster should be encrypted at rest. When enabled, backups are encrypted with AES-256-CFB.",
    ),
  passphrase: z
    .string()
    .optional()
    .describe(
      "Passphrase used to encrypt backups. Required when enabling encryption. 12–256 printable ASCII characters (letters, digits, symbols), no spaces. Store it securely — it is required to restore encrypted backups and cannot be recovered if lost.",
    ),
} satisfies Record<keyof AmericancloudApi.UpdateBackupConfigRequestDto, z.ZodTypeAny>;
const getDatabaseBackupScheduleShape = {
  clusterId,
  schedule_name: z.string().optional().describe("Filter to a specific schedule name."),
  backup_policy_name: z.string().optional().describe("Filter to a specific backup policy."),
} satisfies Record<keyof AmericancloudApi.GetScheduleDatabaseBackupsRequest, z.ZodTypeAny>;

// The SDK nests these under `body: ModifyBackupScheduleRequestDto`; flatten to
// top-level args for the agent and remap in run().
const backupScheduleFields = {
  scheduleName: z.string().describe("Schedule name."),
  backupPolicyName: z.string().describe("Backup policy name."),
  schedules: z
    .array(
      z.object({
        name: z.string().describe("Individual schedule entry name."),
        backupMethod: z.enum(BACKUP_METHODS).describe("Backup engine."),
        cronExpression: z.string().describe("Cron expression for when the backup runs."),
        retentionPeriod: z.string().optional().describe("Retention period for this entry."),
        enabled: z.boolean().optional().describe("Whether this entry is active."),
      }),
    )
    .describe("One or more schedule entries (cron + method)."),
  pitrEnabled: z.boolean().describe("Enable point-in-time recovery."),
} satisfies Record<keyof AmericancloudApi.ModifyBackupScheduleRequestDto, z.ZodTypeAny>;
type _CkSched =
  z.infer<z.ZodObject<typeof backupScheduleFields>> extends AmericancloudApi.ModifyBackupScheduleRequestDto
    ? true
    : never;
const _ckSched: _CkSched = true;
void _ckSched;
const createDatabaseBackupScheduleShape = { clusterId, ...backupScheduleFields };
const updateDatabaseBackupScheduleShape = { clusterId, ...backupScheduleFields };
const deleteDatabaseBackupScheduleShape = {
  clusterId,
  schedule_name: z.string().describe("Schedule name to delete."),
} satisfies Record<keyof AmericancloudApi.DeleteScheduleDatabaseBackupsRequest, z.ZodTypeAny>;
const getDatabaseBackupPolicyShape = {
  clusterId,
  policy_name: z.string().optional().describe("Filter to a specific policy name."),
} satisfies Record<keyof AmericancloudApi.GetPolicyDatabaseBackupsRequest, z.ZodTypeAny>;
const getDatabaseBackupShape = {
  clusterId,
  backupName: z.string().describe("Backup name (from list_database_backups)."),
} satisfies Record<keyof AmericancloudApi.GetDatabaseBackupsRequest, z.ZodTypeAny>;
const deleteDatabaseBackupShape = {
  clusterId,
  backupName: z.string().describe("Backup name to delete."),
} satisfies Record<keyof AmericancloudApi.DeleteDatabaseBackupsRequest, z.ZodTypeAny>;

// ── databaseInfrastructure ─────────────────────────────────────────────────
const listDatabaseInfrastructureShape = {
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListDatabaseInfrastructureRequest, z.ZodTypeAny>;
const getDatabaseInfrastructureShape = {
  userClusterId: z.string().describe("User cluster ID (from list_database_infrastructure)."),
} satisfies Record<keyof AmericancloudApi.GetDatabaseInfrastructureRequest, z.ZodTypeAny>;
const listDatabaseBackupReposShape = {
  userClusterId: z.string().describe("User cluster ID whose backup repositories to list."),
} satisfies Record<keyof AmericancloudApi.ListBackupReposDatabaseInfrastructureRequest, z.ZodTypeAny>;
const repoCredsShape = (verb: string) => ({
  userClusterId: z.string().describe("User cluster ID the repository belongs to."),
  repoName: z.string().describe(`Repository name to ${verb}.`),
  bucket: z.string().describe("S3 bucket name."),
  endpoint: z.string().describe("S3-compatible endpoint URL."),
  accessKeyId: z.string().describe("S3 access key ID."),
  accessKeySecret: z.string().describe("S3 secret access key (sensitive)."),
  pathPrefix: z.string().optional().describe("Optional key prefix within the bucket."),
});
const createDatabaseBackupRepoShape = repoCredsShape("create") satisfies Record<
  keyof AmericancloudApi.SetupBackupRepoRequestDto,
  z.ZodTypeAny
>;
const updateDatabaseBackupRepoShape = repoCredsShape("update") satisfies Record<
  keyof AmericancloudApi.UpdateBackupRepoRequestDto,
  z.ZodTypeAny
>;
const getDatabaseBackupRepoShape = {
  userClusterId: z.string().describe("User cluster ID the repository belongs to."),
  repoName: z.string().describe("Repository name."),
  include_credentials: z.string().optional().describe('Include S3 credentials in the response ("true"/"false").'),
} satisfies Record<keyof AmericancloudApi.GetBackupRepoDatabaseInfrastructureRequest, z.ZodTypeAny>;
const deleteDatabaseBackupRepoShape = {
  userClusterId: z.string().describe("User cluster ID the repository belongs to."),
  repoName: z.string().describe("Repository name to delete."),
  mode: z
    .enum(["retire", "destroy"])
    .optional()
    .describe('"retire" keeps stored backups; "destroy" deletes them too.'),
} satisfies Record<keyof AmericancloudApi.DeleteBackupRepoDatabaseInfrastructureRequest, z.ZodTypeAny>;

// ── databaseOfferings / regions / operations ───────────────────────────────
const listDatabaseOfferingsShape = {
  ...pagination,
  type: z.enum(["postgres", "mysql", "redis"]).optional().describe("Filter offerings by database engine."),
} satisfies Record<keyof AmericancloudApi.ListDatabaseOfferingsRequest, z.ZodTypeAny>;
const getDatabaseOfferingShape = {
  offeringId: z.string().describe("Offering identifier, from list_database_offerings."),
} satisfies Record<keyof AmericancloudApi.GetDatabaseOfferingsRequest, z.ZodTypeAny>;
const getDatabaseOperationStatusShape = {
  correlationId: z.string().describe("Operation correlation ID returned by an earlier database operation."),
} satisfies Record<keyof AmericancloudApi.GetStatusDatabaseOperationsRequest, z.ZodTypeAny>;

export const databasesTools: ToolDef[] = [
  // ── databases ──
  defineTool({ name: "list_databases", title: "List databases", description: "List managed database clusters (MySQL, PostgreSQL, Redis) in your account.", group: "databases", sdkRef: "databases.listDatabases", readOnly: true, idempotent: true, inputSchema: listDatabasesShape, run: (c, a) => c.databases.listDatabases(a) }),
  defineTool({ name: "create_database", title: "Create database", description: "Create a managed database cluster. Pick offering/region from list_database_offerings and list_database_regions; preview cost with get_cost_estimate_database. Optionally restore from a backup.", group: "databases", sdkRef: "databases.createDatabases", readOnly: false, idempotent: false, inputSchema: createDatabaseShape, run: (c, a) => c.databases.createDatabases(a) }),
  defineTool({ name: "get_cost_estimate_database", title: "Get database cost estimate", description: "Preview the price of a managed database configuration (or a resize) without applying it.", group: "databases", sdkRef: "databases.getCostEstimateDatabases", readOnly: true, idempotent: true, inputSchema: getCostEstimateDatabaseShape, run: (c, a) => c.databases.getCostEstimateDatabases(a) }),
  defineTool({ name: "get_database", title: "Get database", description: "Get one managed database cluster by ID: engine, tier, storage, and configuration.", group: "databases", sdkRef: "databases.getDatabases", readOnly: true, idempotent: true, inputSchema: getDatabaseShape, run: (c, a) => c.databases.getDatabases(a) }),
  defineTool({ name: "delete_database", title: "Delete database", description: "Permanently delete a managed database cluster and its data. Cannot be undone.", group: "databases", sdkRef: "databases.deleteDatabases", readOnly: false, destructive: true, idempotent: true, inputSchema: deleteDatabaseShape, run: (c, a) => c.databases.deleteDatabases(a) }),
  defineTool({ name: "get_database_status", title: "Get database status", description: "Get the current status/health of a managed database cluster.", group: "databases", sdkRef: "databases.getStatusDatabases", readOnly: true, idempotent: true, inputSchema: getDatabaseStatusShape, run: (c, a) => c.databases.getStatusDatabases(a) }),
  defineTool({ name: "get_database_connection", title: "Get database connection", description: "Get connection details for a managed database cluster. Set includePassword to include credentials (sensitive).", group: "databases", sdkRef: "databases.getConnectionDatabases", readOnly: true, idempotent: true, inputSchema: getDatabaseConnectionShape, run: (c, a) => c.databases.getConnectionDatabases(a) }),
  defineTool({ name: "get_database_operations", title: "Get database operations", description: "Get the operation history for a managed database cluster.", group: "databases", sdkRef: "databases.getOperationsDatabases", readOnly: true, idempotent: true, inputSchema: getDatabaseOperationsShape, run: (c, a) => c.databases.getOperationsDatabases(a) }),
  defineTool({ name: "start_database", title: "Start database", description: "Start a stopped managed database cluster.", group: "databases", sdkRef: "databases.startDatabases", readOnly: false, idempotent: true, inputSchema: startDatabaseShape, run: (c, a) => c.databases.startDatabases(a) }),
  defineTool({ name: "stop_database", title: "Stop database", description: "Stop a managed database cluster. Disruptive but reversible; data is preserved.", group: "databases", sdkRef: "databases.stopDatabases", readOnly: false, idempotent: true, inputSchema: stopDatabaseShape, run: (c, a) => c.databases.stopDatabases(a) }),
  defineTool({ name: "resize_database", title: "Resize database", description: "Change a managed database cluster's offering and/or storage. Storage can only grow.", group: "databases", sdkRef: "databases.resizeDatabases", readOnly: false, idempotent: true, inputSchema: resizeDatabaseShape, run: (c, a) => c.databases.resizeDatabases(a) }),
  defineTool({ name: "modify_database_load_balancer", title: "Modify database load balancer", description: "Configure the public or private connection load balancer for a managed database cluster.", group: "databases", sdkRef: "databases.modifyLoadBalancerDatabases", readOnly: false, idempotent: true, inputSchema: modifyDatabaseLoadBalancerShape, run: (c, a) => c.databases.modifyLoadBalancerDatabases(a) }),
  defineTool({ name: "delete_database_load_balancer", title: "Delete database load balancer", description: "Remove the public or private connection load balancer from a managed database cluster. Cannot be undone.", group: "databases", sdkRef: "databases.deleteLoadBalancerDatabases", readOnly: false, destructive: true, idempotent: true, inputSchema: deleteDatabaseLoadBalancerShape, run: (c, a) => c.databases.deleteLoadBalancerDatabases(a) }),

  // ── databaseBackups ──
  defineTool({ name: "set_active_database_backup_repo", title: "Set active database backup repo", description: "Set which backup repository is active for a managed database cluster.", group: "databases", sdkRef: "databaseBackups.setActiveRepoDatabaseBackups", readOnly: false, idempotent: true, inputSchema: setActiveDatabaseBackupRepoShape, run: (c, a) => c.databaseBackups.setActiveRepoDatabaseBackups(a) }),
  defineTool({ name: "list_database_backups", title: "List database backups", description: "List the backups for a managed database cluster.", group: "databases", sdkRef: "databaseBackups.listDatabaseBackups", readOnly: true, idempotent: true, inputSchema: listDatabaseBackupsShape, run: (c, a) => c.databaseBackups.listDatabaseBackups(a) }),
  defineTool({ name: "trigger_database_backup", title: "Trigger database backup", description: "Trigger an on-demand backup of a managed database cluster with the given method and retention. A backup needs the cluster's infrastructure running; while it is still starting the call is refused and the error code says so, so retry once it is running.", group: "databases", sdkRef: "databaseBackups.triggerDatabaseBackups", readOnly: false, idempotent: false, inputSchema: triggerDatabaseBackupShape, run: (c, a) => c.databaseBackups.triggerDatabaseBackups(a) }),
  defineTool({ name: "get_database_backup_config", title: "Get database backup config", description: "Get the backup configuration for a managed database cluster.", group: "databases", sdkRef: "databaseBackups.getConfigDatabaseBackups", readOnly: true, idempotent: true, inputSchema: getDatabaseBackupConfigShape, run: (c, a) => c.databaseBackups.getConfigDatabaseBackups(a) }),
  defineTool({ name: "update_database_backup_config", title: "Update database backup config", description: "Enable or disable encryption of a managed database cluster's backups. When enabling, provide a passphrase (12–256 printable ASCII characters, no spaces) and store it securely — it is required to restore the encrypted backups and cannot be recovered if lost. Check the current state with get_database_backup_config.", group: "databases", sdkRef: "databaseBackups.updateConfigDatabaseBackups", readOnly: false, idempotent: true, inputSchema: updateDatabaseBackupConfigShape, run: (c, a) => c.databaseBackups.updateConfigDatabaseBackups(a) }),
  defineTool({ name: "get_database_backup_schedule", title: "Get database backup schedule", description: "Get the backup schedule(s) for a managed database cluster.", group: "databases", sdkRef: "databaseBackups.getScheduleDatabaseBackups", readOnly: true, idempotent: true, inputSchema: getDatabaseBackupScheduleShape, run: (c, a) => c.databaseBackups.getScheduleDatabaseBackups(a) }),
  defineTool({ name: "create_database_backup_schedule", title: "Create database backup schedule", description: "Create a backup schedule (one or more cron entries) for a managed database cluster.", group: "databases", sdkRef: "databaseBackups.createScheduleDatabaseBackups", readOnly: false, idempotent: false, inputSchema: createDatabaseBackupScheduleShape, run: (c, { clusterId, ...body }) => c.databaseBackups.createScheduleDatabaseBackups({ clusterId, body }) }),
  defineTool({ name: "update_database_backup_schedule", title: "Update database backup schedule", description: "Replace the backup schedule for a managed database cluster.", group: "databases", sdkRef: "databaseBackups.updateScheduleDatabaseBackups", readOnly: false, idempotent: true, inputSchema: updateDatabaseBackupScheduleShape, run: (c, { clusterId, ...body }) => c.databaseBackups.updateScheduleDatabaseBackups({ clusterId, body }) }),
  defineTool({ name: "delete_database_backup_schedule", title: "Delete database backup schedule", description: "Delete a backup schedule from a managed database cluster. Cannot be undone.", group: "databases", sdkRef: "databaseBackups.deleteScheduleDatabaseBackups", readOnly: false, destructive: true, idempotent: true, inputSchema: deleteDatabaseBackupScheduleShape, run: (c, a) => c.databaseBackups.deleteScheduleDatabaseBackups(a) }),
  defineTool({ name: "get_database_backup_policy", title: "Get database backup policy", description: "Get the backup retention policy for a managed database cluster.", group: "databases", sdkRef: "databaseBackups.getPolicyDatabaseBackups", readOnly: true, idempotent: true, inputSchema: getDatabaseBackupPolicyShape, run: (c, a) => c.databaseBackups.getPolicyDatabaseBackups(a) }),
  defineTool({ name: "get_database_backup", title: "Get database backup", description: "Get details of a single backup by name for a managed database cluster.", group: "databases", sdkRef: "databaseBackups.getDatabaseBackups", readOnly: true, idempotent: true, inputSchema: getDatabaseBackupShape, run: (c, a) => c.databaseBackups.getDatabaseBackups(a) }),
  defineTool({ name: "delete_database_backup", title: "Delete database backup", description: "Permanently delete a backup by name. Cannot be undone.", group: "databases", sdkRef: "databaseBackups.deleteDatabaseBackups", readOnly: false, destructive: true, idempotent: true, inputSchema: deleteDatabaseBackupShape, run: (c, a) => c.databaseBackups.deleteDatabaseBackups(a) }),

  // ── databaseInfrastructure ──
  defineTool({ name: "list_database_infrastructure", title: "List database infrastructure", description: "List database infrastructure (networking/backup configuration) across your managed databases.", group: "databases", sdkRef: "databaseInfrastructure.listDatabaseInfrastructure", readOnly: true, idempotent: true, inputSchema: listDatabaseInfrastructureShape, run: (c, a) => c.databaseInfrastructure.listDatabaseInfrastructure(a) }),
  defineTool({ name: "get_database_infrastructure", title: "Get database infrastructure", description: "Get the infrastructure configuration for a specific database user cluster.", group: "databases", sdkRef: "databaseInfrastructure.getDatabaseInfrastructure", readOnly: true, idempotent: true, inputSchema: getDatabaseInfrastructureShape, run: (c, a) => c.databaseInfrastructure.getDatabaseInfrastructure(a) }),
  defineTool({ name: "list_database_backup_repos", title: "List database backup repos", description: "List the S3 backup repositories configured for a database user cluster.", group: "databases", sdkRef: "databaseInfrastructure.listBackupReposDatabaseInfrastructure", readOnly: true, idempotent: true, inputSchema: listDatabaseBackupReposShape, run: (c, a) => c.databaseInfrastructure.listBackupReposDatabaseInfrastructure(a) }),
  defineTool({ name: "create_database_backup_repo", title: "Create database backup repo", description: "Configure an S3-compatible backup repository for a database user cluster.", group: "databases", sdkRef: "databaseInfrastructure.createBackupRepoDatabaseInfrastructure", readOnly: false, idempotent: false, inputSchema: createDatabaseBackupRepoShape, run: (c, a) => c.databaseInfrastructure.createBackupRepoDatabaseInfrastructure(a) }),
  defineTool({ name: "update_database_backup_repo", title: "Update database backup repo", description: "Update an existing S3 backup repository's settings/credentials.", group: "databases", sdkRef: "databaseInfrastructure.updateBackupRepoDatabaseInfrastructure", readOnly: false, idempotent: true, inputSchema: updateDatabaseBackupRepoShape, run: (c, a) => c.databaseInfrastructure.updateBackupRepoDatabaseInfrastructure(a) }),
  defineTool({ name: "get_database_backup_repo", title: "Get database backup repo", description: "Get a backup repository's configuration. With include_credentials set, the response includes the repository's S3 access keys — treat those as sensitive.", group: "databases", sdkRef: "databaseInfrastructure.getBackupRepoDatabaseInfrastructure", readOnly: true, idempotent: true, inputSchema: getDatabaseBackupRepoShape, run: (c, a) => c.databaseInfrastructure.getBackupRepoDatabaseInfrastructure(a) }),
  defineTool({ name: "delete_database_backup_repo", title: "Delete database backup repo", description: "Delete a backup repository. With mode=destroy, stored backups are deleted too. A repository that a cluster still uses is refused — move that cluster to another repository with set_active_database_backup_repo first. Cannot be undone.", group: "databases", sdkRef: "databaseInfrastructure.deleteBackupRepoDatabaseInfrastructure", readOnly: false, destructive: true, idempotent: true, inputSchema: deleteDatabaseBackupRepoShape, run: (c, a) => c.databaseInfrastructure.deleteBackupRepoDatabaseInfrastructure(a) }),

  // ── databaseOfferings / regions / operations ──
  defineTool({ name: "list_database_offerings", title: "List database offerings", description: "List available managed-database offerings (compute/storage tiers), optionally filtered by engine.", group: "databases", sdkRef: "databaseOfferings.listDatabaseOfferings", readOnly: true, idempotent: true, inputSchema: listDatabaseOfferingsShape, run: (c, a) => c.databaseOfferings.listDatabaseOfferings(a) }),
  defineTool({ name: "get_database_offering", title: "Get database offering", description: "Get one managed-database offering by ID.", group: "databases", sdkRef: "databaseOfferings.getDatabaseOfferings", readOnly: true, idempotent: true, inputSchema: getDatabaseOfferingShape, run: (c, a) => c.databaseOfferings.getDatabaseOfferings(a) }),
  defineTool({ name: "list_database_regions", title: "List database regions", description: "List the regions where managed databases can be provisioned.", group: "databases", sdkRef: "databaseRegions.listDatabaseRegions", readOnly: true, idempotent: true, inputSchema: {}, run: (c) => c.databaseRegions.listDatabaseRegions() }),
  defineTool({ name: "get_database_operation_status", title: "Get database operation status", description: "Get the status of an asynchronous database operation by its correlation ID.", group: "databases", sdkRef: "databaseOperations.getStatusDatabaseOperations", readOnly: true, idempotent: true, inputSchema: getDatabaseOperationStatusShape, run: (c, a) => c.databaseOperations.getStatusDatabaseOperations(a) }),
];
