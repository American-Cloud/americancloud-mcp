/**
 * Kubernetes group.
 */
import { z } from "zod";
import type { AmericancloudApi } from "@americancloud/sdk";
import { defineTool, type ToolDef } from "../tooldef.js";
import { pagination } from "../schemas.js";

const clusterId = z.string().describe("Kubernetes cluster identifier (UUID), from list_kubernetes_clusters.");

const listKubernetesVersionsShape = {
  current_version: z
    .string()
    .optional()
    .describe("If set, return only versions that are valid upgrade targets from this version."),
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListVersionsKubernetesRequest, z.ZodTypeAny>;

const listKubernetesPackagesShape = {
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListPackagesKubernetesRequest, z.ZodTypeAny>;

const listKubernetesClustersShape = {
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListClustersKubernetesRequest, z.ZodTypeAny>;

const getKubernetesClusterShape = {
  id: clusterId,
  details: z.boolean().optional().describe("Include detailed node and status information."),
} satisfies Record<keyof AmericancloudApi.GetClusterKubernetesRequest, z.ZodTypeAny>;

const deleteKubernetesClusterShape = {
  id: clusterId,
} satisfies Record<keyof AmericancloudApi.DeleteClusterKubernetesRequest, z.ZodTypeAny>;

const createKubernetesClusterShape = {
  name: z.string().min(1).describe("Cluster name."),
  package: z.string().describe("Kubernetes package label (from list_kubernetes_packages)."),
  region: z.string().describe('Region label, e.g. "us-west-0" (from list_regions).'),
  version: z.string().describe("Kubernetes version (from list_kubernetes_versions)."),
  controlNodes: z.number().int().min(1).describe("Number of control-plane nodes."),
  workerNodes: z.number().int().min(0).describe("Number of worker nodes."),
  description: z.string().optional().describe("Optional description for the cluster."),
  networkId: z
    .string()
    .optional()
    .describe("UUID of an existing network to place the cluster in. Omit to auto-create one."),
  keypair: z.string().optional().describe("SSH key pair name to install on nodes (from list_ssh_keys)."),
} satisfies Record<keyof AmericancloudApi.CreateKubernetesClusterRequest, z.ZodTypeAny>;

type _CheckCreateK8s =
  z.infer<z.ZodObject<typeof createKubernetesClusterShape>> extends AmericancloudApi.CreateKubernetesClusterRequest
    ? true
    : never;
const _checkCreateK8s: _CheckCreateK8s = true;
void _checkCreateK8s;

const powerKubernetesClusterShape = {
  id: clusterId,
  action: z.enum(["start", "stop"]).describe("Power action for the cluster."),
} satisfies Record<keyof AmericancloudApi.ClusterPowerKubernetesRequest, z.ZodTypeAny>;

type _CheckPowerK8s =
  z.infer<z.ZodObject<typeof powerKubernetesClusterShape>> extends AmericancloudApi.ClusterPowerKubernetesRequest
    ? true
    : never;
const _checkPowerK8s: _CheckPowerK8s = true;
void _checkPowerK8s;

const getKubernetesClusterConfigShape = {
  id: clusterId,
} satisfies Record<keyof AmericancloudApi.GetClusterConfigKubernetesRequest, z.ZodTypeAny>;

const scaleKubernetesClusterShape = {
  id: clusterId,
  workerNodes: z.number().int().min(0).optional().describe("Fixed worker-node count (when autoscaling is off)."),
  autoscalingEnabled: z.boolean().optional().describe("Enable or disable worker autoscaling."),
  minWorkers: z.number().int().min(0).optional().describe("Minimum workers when autoscaling is on."),
  maxWorkers: z.number().int().min(0).optional().describe("Maximum workers when autoscaling is on."),
} satisfies Record<keyof AmericancloudApi.ScaleKubernetesClusterRequest, z.ZodTypeAny>;

const upgradeKubernetesClusterShape = {
  id: clusterId,
  version: z.string().describe("Target Kubernetes version (from list_kubernetes_versions)."),
} satisfies Record<keyof AmericancloudApi.UpgradeKubernetesClusterRequest, z.ZodTypeAny>;

export const kubernetesTools: ToolDef[] = [
  defineTool({
    name: "list_kubernetes_versions",
    title: "List Kubernetes versions",
    description:
      "List the available Kubernetes versions. Pass current_version to get only valid upgrade targets from a running cluster's version.",
    group: "kubernetes",
    sdkRef: "kubernetes.listVersionsKubernetes",
    readOnly: true,
    idempotent: true,
    inputSchema: listKubernetesVersionsShape,
    run: (client, args) => client.kubernetes.listVersionsKubernetes(args),
  }),
  defineTool({
    name: "list_kubernetes_packages",
    title: "List Kubernetes packages",
    description: "List the available Kubernetes node packages (sizing/pricing tiers) for cluster creation.",
    group: "kubernetes",
    sdkRef: "kubernetes.listPackagesKubernetes",
    readOnly: true,
    idempotent: true,
    inputSchema: listKubernetesPackagesShape,
    run: (client, args) => client.kubernetes.listPackagesKubernetes(args),
  }),
  defineTool({
    name: "list_kubernetes_clusters",
    title: "List Kubernetes clusters",
    description: "List the Kubernetes clusters in your account with their IDs, status, version, and node counts.",
    group: "kubernetes",
    sdkRef: "kubernetes.listClustersKubernetes",
    readOnly: true,
    idempotent: true,
    inputSchema: listKubernetesClustersShape,
    run: (client, args) => client.kubernetes.listClustersKubernetes(args),
  }),
  defineTool({
    name: "get_kubernetes_cluster",
    title: "Get Kubernetes cluster",
    description: "Get one Kubernetes cluster by ID. Pass details=true for full node and status information.",
    group: "kubernetes",
    sdkRef: "kubernetes.getClusterKubernetes",
    readOnly: true,
    idempotent: true,
    inputSchema: getKubernetesClusterShape,
    run: (client, args) => client.kubernetes.getClusterKubernetes(args),
  }),
  defineTool({
    name: "delete_kubernetes_cluster",
    title: "Delete Kubernetes cluster",
    description:
      "Permanently delete a Kubernetes cluster and all of its nodes. Workloads and any node-local data are lost. Cannot be undone.",
    group: "kubernetes",
    sdkRef: "kubernetes.deleteClusterKubernetes",
    readOnly: false,
    destructive: true,
    idempotent: true,
    inputSchema: deleteKubernetesClusterShape,
    run: (client, args) => client.kubernetes.deleteClusterKubernetes(args),
  }),
  defineTool({
    name: "create_kubernetes_cluster",
    title: "Create Kubernetes cluster",
    description:
      "Create a managed Kubernetes cluster. Pick package/region/version from the list_kubernetes_* tools; preview cost with get_cost_estimate_kubernetes. Provisions asynchronously — poll get_kubernetes_cluster.",
    group: "kubernetes",
    sdkRef: "kubernetes.createClusterKubernetes",
    readOnly: false,
    idempotent: false,
    inputSchema: createKubernetesClusterShape,
    run: (client, args) => client.kubernetes.createClusterKubernetes(args),
  }),
  defineTool({
    name: "get_cost_estimate_kubernetes",
    title: "Get Kubernetes cost estimate",
    description:
      "Preview the price of a Kubernetes cluster configuration without creating it. Takes the same arguments as create_kubernetes_cluster.",
    group: "kubernetes",
    sdkRef: "kubernetes.getCostEstimateKubernetes",
    readOnly: true,
    idempotent: true,
    inputSchema: createKubernetesClusterShape,
    run: (client, args) => client.kubernetes.getCostEstimateKubernetes(args),
  }),
  defineTool({
    name: "power_kubernetes_cluster",
    title: "Power Kubernetes cluster",
    description:
      "Start or stop a Kubernetes cluster. Stopping is disruptive but reversible; persistent data is preserved.",
    group: "kubernetes",
    sdkRef: "kubernetes.clusterPowerKubernetes",
    readOnly: false,
    idempotent: true,
    inputSchema: powerKubernetesClusterShape,
    run: (client, args) => client.kubernetes.clusterPowerKubernetes(args),
  }),
  defineTool({
    name: "get_kubernetes_cluster_config",
    title: "Get Kubernetes cluster config",
    description:
      "Get the kubeconfig (YAML) for a cluster, used to connect kubectl and other Kubernetes tooling. Treat it as sensitive — it grants cluster access.",
    group: "kubernetes",
    sdkRef: "kubernetes.getClusterConfigKubernetes",
    readOnly: true,
    idempotent: true,
    inputSchema: getKubernetesClusterConfigShape,
    run: (client, args) => client.kubernetes.getClusterConfigKubernetes(args),
  }),
  defineTool({
    name: "scale_kubernetes_cluster",
    title: "Scale Kubernetes cluster",
    description:
      "Change a cluster's worker capacity: set a fixed workerNodes count, or enable autoscaling with minWorkers/maxWorkers.",
    group: "kubernetes",
    sdkRef: "kubernetes.scaleClusterKubernetes",
    readOnly: false,
    idempotent: true,
    inputSchema: scaleKubernetesClusterShape,
    run: (client, args) => client.kubernetes.scaleClusterKubernetes(args),
  }),
  defineTool({
    name: "upgrade_kubernetes_cluster",
    title: "Upgrade Kubernetes cluster",
    description:
      "Upgrade a cluster to a newer Kubernetes version (one minor version at a time). Use list_kubernetes_versions with current_version to find valid targets.",
    group: "kubernetes",
    sdkRef: "kubernetes.upgradeClusterKubernetes",
    readOnly: false,
    idempotent: true,
    inputSchema: upgradeKubernetesClusterShape,
    run: (client, args) => client.kubernetes.upgradeClusterKubernetes(args),
  }),
];
