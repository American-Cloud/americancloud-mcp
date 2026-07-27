/**
 * Networking group: isolatedNetworks, vpcNetworks, publicIps, firewallRules,
 * portForwarding, loadBalancerRules, egressRules, networkAcls.
 * Port-forwarding and load-balancer ports are strings (CloudStack-style);
 * firewall/egress/ACL rule ports are integers (1-65535).
 */
import { z } from "zod";
import type { AmericancloudApi, AmericancloudApiClient } from "@americancloud/sdk";
import { defineTool, type ToolDef } from "../tooldef.js";
import { pagination } from "../schemas.js";

// Merged DTOs (carry enum namespaces) — derive from method signatures.
type CreateFirewallRuleDto = Parameters<AmericancloudApiClient["firewallRules"]["createFirewallRules"]>[0];
type CreatePortForwardingRuleDto = Parameters<AmericancloudApiClient["portForwarding"]["createPortForwarding"]>[0];
type CreateLoadBalancerRuleDto = Parameters<AmericancloudApiClient["loadBalancerRules"]["createLoadBalancerRules"]>[0];
type UpdateLoadBalancerRuleDto = Parameters<AmericancloudApiClient["loadBalancerRules"]["updateLoadBalancerRules"]>[0];

// ── isolatedNetworks ───────────────────────────────────────────────────────
const listIsolatedNetworksShape = {
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListIsolatedNetworksRequest, z.ZodTypeAny>;
const createIsolatedNetworkShape = {
  name: z.string().min(1).describe("Network name."),
  description: z.string().optional().describe("Optional description."),
  region: z.string().describe('Region label, e.g. "us-west-0" (from list_regions).'),
  netmask: z.string().optional().describe('Netmask, e.g. "255.255.255.0". Omit for the default.'),
  gateway: z.string().optional().describe('Gateway IP, e.g. "10.0.0.1". Omit for the default.'),
} satisfies Record<keyof AmericancloudApi.CreateIsolatedNetworkDto, z.ZodTypeAny>;
const getIsolatedNetworkShape = {
  id: z.string().describe("Isolated network identifier (UUID), from list_isolated_networks."),
} satisfies Record<keyof AmericancloudApi.GetIsolatedNetworksRequest, z.ZodTypeAny>;
const updateIsolatedNetworkShape = {
  id: z.string().describe("Isolated network identifier (UUID)."),
  name: z.string().optional().describe("New name."),
  description: z.string().optional().describe("New description."),
} satisfies Record<keyof AmericancloudApi.UpdateIsolatedNetworkDto, z.ZodTypeAny>;
const deleteIsolatedNetworkShape = {
  id: z.string().describe("Isolated network identifier (UUID) to delete."),
} satisfies Record<keyof AmericancloudApi.DeleteIsolatedNetworksRequest, z.ZodTypeAny>;
const restartIsolatedNetworkShape = {
  id: z.string().describe("Isolated network identifier (UUID) to restart."),
} satisfies Record<keyof AmericancloudApi.RestartIsolatedNetworksRequest, z.ZodTypeAny>;

// ── vpcNetworks ────────────────────────────────────────────────────────────
const listVpcNetworksShape = {
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListVpcNetworksRequest, z.ZodTypeAny>;
const createVpcNetworkShape = {
  name: z.string().min(1).describe("VPC name."),
  description: z.string().optional().describe("Optional description."),
  region: z.string().describe('Region label, e.g. "us-west-0" (from list_regions).'),
  cidr: z.string().describe('VPC CIDR block, e.g. "10.0.0.0/16".'),
} satisfies Record<keyof AmericancloudApi.CreateVpcNetworkDto, z.ZodTypeAny>;
const getVpcNetworkShape = {
  id: z.string().describe("VPC identifier (UUID), from list_vpc_networks."),
} satisfies Record<keyof AmericancloudApi.GetVpcNetworksRequest, z.ZodTypeAny>;
const updateVpcNetworkShape = {
  id: z.string().describe("VPC identifier (UUID)."),
  name: z.string().optional().describe("New name."),
  description: z.string().optional().describe("New description."),
} satisfies Record<keyof AmericancloudApi.UpdateVpcNetworkDto, z.ZodTypeAny>;
const deleteVpcNetworkShape = {
  id: z.string().describe("VPC identifier (UUID) to delete."),
} satisfies Record<keyof AmericancloudApi.DeleteVpcNetworksRequest, z.ZodTypeAny>;
const createVpcTierShape = {
  name: z.string().min(1).describe("Tier (subnet) name."),
  description: z.string().optional().describe("Optional description."),
  vpcId: z.string().describe("Parent VPC identifier (UUID)."),
  gateway: z.string().describe('Tier gateway IP, e.g. "10.0.1.1".'),
  netmask: z.string().describe('Tier netmask, e.g. "255.255.255.0".'),
  aclId: z.string().optional().describe("Network ACL list ID to apply to the tier (from list_network_acl_lists)."),
} satisfies Record<keyof AmericancloudApi.CreateVpcTierDto, z.ZodTypeAny>;
const deleteVpcTierShape = {
  id: z.string().describe("VPC identifier (UUID) that contains the tier."),
  tierId: z.string().describe("Tier (subnet) identifier (UUID) to delete, from get_vpc_network."),
} satisfies Record<keyof AmericancloudApi.DeleteTierVpcNetworksRequest, z.ZodTypeAny>;
const getVpcTierShape = {
  id: z.string().describe("VPC identifier (UUID) that contains the tier."),
  tierId: z.string().describe("Tier (subnet) identifier (UUID), from get_vpc_network."),
} satisfies Record<keyof AmericancloudApi.GetTierVpcNetworksRequest, z.ZodTypeAny>;
const updateVpcTierShape = {
  id: z.string().describe("VPC identifier (UUID) that contains the tier."),
  tierId: z.string().describe("Tier (subnet) identifier (UUID) to update, from get_vpc_network."),
  name: z.string().optional().describe("New name."),
  description: z.string().optional().describe("New description."),
} satisfies Record<keyof AmericancloudApi.UpdateVpcTierDto, z.ZodTypeAny>;
const restartVpcTierShape = {
  id: z.string().describe("VPC identifier (UUID) that contains the tier."),
  tierId: z.string().describe("Tier (subnet) identifier (UUID) to restart, from get_vpc_network."),
} satisfies Record<keyof AmericancloudApi.RestartTierVpcNetworksRequest, z.ZodTypeAny>;
const restartVpcNetworkShape = {
  id: z.string().describe("VPC identifier (UUID) to restart."),
} satisfies Record<keyof AmericancloudApi.RestartVpcNetworksRequest, z.ZodTypeAny>;

// ── publicIps ──────────────────────────────────────────────────────────────
const listPublicIpsShape = {
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListPublicIpsRequest, z.ZodTypeAny>;
const reservePublicIpShape = {
  networkId: z.string().optional().describe("Isolated network UUID to reserve the IP in (or use vpcId)."),
  vpcId: z.string().optional().describe("VPC UUID to reserve the IP in (or use networkId)."),
  region: z.string().describe('Region label, e.g. "us-west-0".'),
} satisfies Record<keyof AmericancloudApi.ReservePublicIpDto, z.ZodTypeAny>;
const listPublicIpsByIsolatedNetworkShape = {
  isolatedNetworkId: z.string().describe("Isolated network identifier (UUID)."),
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListByIsolatedNetworkPublicIpsRequest, z.ZodTypeAny>;
const listPublicIpsByVpcShape = {
  vpcId: z.string().describe("VPC identifier (UUID)."),
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListByVpcPublicIpsRequest, z.ZodTypeAny>;
const getPublicIpShape = {
  id: z.string().describe("Public IP identifier (UUID), from list_public_ips."),
} satisfies Record<keyof AmericancloudApi.GetPublicIpsRequest, z.ZodTypeAny>;
const releasePublicIpShape = {
  id: z.string().describe("Public IP identifier (UUID) to release."),
} satisfies Record<keyof AmericancloudApi.ReleasePublicIpsRequest, z.ZodTypeAny>;
const changeSourceNatIpShape = {
  id: z.string().describe("Public IP identifier (UUID) to make the source NAT IP."),
  networkId: z.string().describe("Network UUID whose source NAT IP to change."),
} satisfies Record<keyof AmericancloudApi.ChangeSourceNatIpDto, z.ZodTypeAny>;
const enableStaticNatShape = {
  id: z.string().describe("Public IP identifier (UUID)."),
  virtualMachineId: z.string().describe("VM UUID to map the public IP to (from list_vms)."),
} satisfies Record<keyof AmericancloudApi.EnableStaticNatDto, z.ZodTypeAny>;
const disableStaticNatShape = {
  id: z.string().describe("Public IP identifier (UUID) to disable static NAT on."),
} satisfies Record<keyof AmericancloudApi.DisableStaticNatPublicIpsRequest, z.ZodTypeAny>;

// ── firewallRules ──────────────────────────────────────────────────────────
const listFirewallRulesShape = {
  ipId: z.string().describe("Public IP identifier (UUID) whose firewall rules to list."),
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListFirewallRulesRequest, z.ZodTypeAny>;
const createFirewallRuleShape = {
  ipId: z.string().describe("Public IP identifier (UUID) to attach the rule to."),
  protocol: z.enum(["TCP", "UDP", "ICMP", "ALL"]).describe("Protocol the rule applies to."),
  startPort: z.number().int().min(1).max(65535).optional().describe("Start of the port range (1-65535). Omit for ICMP/ALL."),
  endPort: z.number().int().min(1).max(65535).optional().describe("End of the port range (1-65535). Omit for ICMP/ALL."),
  sourceCidrList: z.string().describe('Allowed source CIDR(s), e.g. "0.0.0.0/0" for anywhere.'),
  type: z.enum(["Ingress", "Egress"]).optional().describe("Rule direction. Defaults to Ingress."),
} satisfies Record<keyof CreateFirewallRuleDto, z.ZodTypeAny>;
type _CkFw = z.infer<z.ZodObject<typeof createFirewallRuleShape>> extends CreateFirewallRuleDto ? true : never;
const _ckFw: _CkFw = true;
void _ckFw;
const deleteFirewallRuleShape = {
  ruleId: z.string().describe("Firewall rule identifier (UUID) to delete."),
} satisfies Record<keyof AmericancloudApi.DeleteFirewallRulesRequest, z.ZodTypeAny>;

// ── portForwarding ─────────────────────────────────────────────────────────
const listPortForwardingShape = {
  ipId: z.string().describe("Public IP identifier (UUID) whose port-forwarding rules to list."),
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListPortForwardingRequest, z.ZodTypeAny>;
const createPortForwardingRuleShape = {
  ipId: z.string().describe("Public IP identifier (UUID) to attach the rule to."),
  privatePort: z.string().describe("Private (VM) port (string)."),
  publicPort: z.string().describe("Public port (string)."),
  protocol: z.enum(["TCP", "UDP"]).describe("Protocol."),
  vmId: z.string().describe("VM UUID to forward traffic to (from list_vms)."),
  openFirewall: z.string().optional().describe('Whether to open the firewall too ("true"/"false").'),
  tierId: z
    .string()
    .optional()
    .describe(
      "For a public IP reserved in a VPC, the VPC tier (UUID, from get_vpc_network) the rule applies to. Only needed when the VM has interfaces in more than one tier of the VPC — otherwise it is inferred from the VM. Ignored for IPs in an isolated network.",
    ),
} satisfies Record<keyof CreatePortForwardingRuleDto, z.ZodTypeAny>;
type _CkPf = z.infer<z.ZodObject<typeof createPortForwardingRuleShape>> extends CreatePortForwardingRuleDto ? true : never;
const _ckPf: _CkPf = true;
void _ckPf;
const deletePortForwardingRuleShape = {
  ruleId: z.string().describe("Port-forwarding rule identifier (UUID) to delete."),
} satisfies Record<keyof AmericancloudApi.DeletePortForwardingRequest, z.ZodTypeAny>;

// ── loadBalancerRules ──────────────────────────────────────────────────────
const listLoadBalancerRulesShape = {
  ipId: z.string().describe("Public IP identifier (UUID) whose load balancer rules to list."),
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListLoadBalancerRulesRequest, z.ZodTypeAny>;
const createLoadBalancerRuleShape = {
  ipId: z.string().describe("Public IP identifier (UUID) to attach the rule to."),
  name: z.string().min(1).describe("Rule name."),
  algorithm: z.enum(["roundrobin", "leastconn", "source"]).describe("Load balancing algorithm."),
  publicPort: z.string().describe("Public port (string)."),
  privatePort: z.string().describe("Private (backend) port (string)."),
  protocol: z.enum(["tcp", "udp", "tcp-proxy"]).optional().describe("Protocol. Defaults to tcp."),
  sourceCidrList: z.string().optional().describe("Restrict to source CIDR(s)."),
  description: z.string().optional().describe("Optional description."),
} satisfies Record<keyof CreateLoadBalancerRuleDto, z.ZodTypeAny>;
type _CkLb = z.infer<z.ZodObject<typeof createLoadBalancerRuleShape>> extends CreateLoadBalancerRuleDto ? true : never;
const _ckLb: _CkLb = true;
void _ckLb;
const updateLoadBalancerRuleShape = {
  ruleId: z.string().describe("Load balancer rule identifier (UUID)."),
  name: z.string().optional().describe("New name."),
  algorithm: z.enum(["roundrobin", "leastconn", "source"]).optional().describe("New algorithm."),
  description: z.string().optional().describe("New description."),
  protocol: z.string().optional().describe("New protocol."),
  sourceCidrList: z.string().optional().describe("New source CIDR restriction."),
} satisfies Record<keyof UpdateLoadBalancerRuleDto, z.ZodTypeAny>;
type _CkLbU = z.infer<z.ZodObject<typeof updateLoadBalancerRuleShape>> extends UpdateLoadBalancerRuleDto ? true : never;
const _ckLbU: _CkLbU = true;
void _ckLbU;
const deleteLoadBalancerRuleShape = {
  ruleId: z.string().describe("Load balancer rule identifier (UUID) to delete."),
} satisfies Record<keyof AmericancloudApi.DeleteLoadBalancerRulesRequest, z.ZodTypeAny>;
const listLoadBalancerInstancesShape = {
  ruleId: z.string().describe("Load balancer rule identifier (UUID)."),
  applied: z.boolean().optional().describe("Filter to VMs already assigned to the rule."),
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListInstancesLoadBalancerRulesRequest, z.ZodTypeAny>;
// assign/remove: SDK shape is {ruleId, body:{vmIds}}; flatten for the agent and remap in run.
const assignVmsToLoadBalancerShape = {
  ruleId: z.string().describe("Load balancer rule identifier (UUID)."),
  vmIds: z.array(z.string()).describe("VM UUIDs to assign to the rule (from list_vms)."),
};
const removeVmsFromLoadBalancerShape = {
  ruleId: z.string().describe("Load balancer rule identifier (UUID)."),
  vmIds: z.array(z.string()).describe("VM UUIDs to remove from the rule."),
};

// ── egressRules ────────────────────────────────────────────────────────────
const listEgressRulesShape = {
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListEgressRulesRequest, z.ZodTypeAny>;
const createEgressRuleShape = {
  protocol: z.string().describe('Protocol, e.g. "TCP", "UDP", "ICMP", or "ALL".'),
  startPort: z.number().int().min(1).max(65535).optional().describe("Start port (1-65535)."),
  endPort: z.number().int().min(1).max(65535).optional().describe("End port (1-65535)."),
  sourceCidrList: z.string().optional().describe("Source CIDR(s) within the network."),
  destCidrList: z.string().optional().describe("Destination CIDR(s)."),
  networkId: z.string().optional().describe("Isolated network UUID the rule applies to."),
} satisfies Record<keyof AmericancloudApi.CreateEgressRuleDto, z.ZodTypeAny>;
const listEgressRulesByNetworkShape = {
  networkId: z.string().describe("Isolated network identifier (UUID)."),
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListByNetworkEgressRulesRequest, z.ZodTypeAny>;
const getEgressRuleShape = {
  id: z.string().describe("Egress rule identifier (UUID), from list_egress_rules."),
} satisfies Record<keyof AmericancloudApi.GetEgressRulesRequest, z.ZodTypeAny>;
const updateEgressRuleShape = {
  id: z.string().describe("Egress rule identifier (UUID)."),
  sourceCidrList: z.string().optional().describe("New source CIDR(s)."),
  destCidrList: z.string().optional().describe("New destination CIDR(s)."),
  startPort: z.number().int().min(1).max(65535).optional().describe("New start port (1-65535)."),
  endPort: z.number().int().min(1).max(65535).optional().describe("New end port (1-65535)."),
} satisfies Record<keyof AmericancloudApi.UpdateEgressRuleDto, z.ZodTypeAny>;
const deleteEgressRuleShape = {
  id: z.string().describe("Egress rule identifier (UUID) to delete."),
} satisfies Record<keyof AmericancloudApi.DeleteEgressRulesRequest, z.ZodTypeAny>;

// ── networkAcls ────────────────────────────────────────────────────────────
const listNetworkAclListsShape = {
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListListsNetworkAclsRequest, z.ZodTypeAny>;
const createNetworkAclListShape = {
  name: z.string().min(1).describe("ACL list name."),
  description: z.string().optional().describe("Optional description."),
  vpcId: z.string().describe("VPC identifier (UUID) the ACL list belongs to."),
} satisfies Record<keyof AmericancloudApi.CreateNetworkAclListDto, z.ZodTypeAny>;
const listNetworkAclListsByVpcShape = {
  vpcId: z.string().describe("VPC identifier (UUID)."),
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListListsByVpcNetworkAclsRequest, z.ZodTypeAny>;
const getNetworkAclListShape = {
  id: z.string().describe("ACL list identifier (UUID), from list_network_acl_lists."),
} satisfies Record<keyof AmericancloudApi.GetListNetworkAclsRequest, z.ZodTypeAny>;
const deleteNetworkAclListShape = {
  id: z.string().describe("ACL list identifier (UUID) to delete."),
} satisfies Record<keyof AmericancloudApi.DeleteListNetworkAclsRequest, z.ZodTypeAny>;
const listNetworkAclRulesShape = {
  listId: z.string().describe("ACL list identifier (UUID) whose rules to list."),
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListRulesNetworkAclsRequest, z.ZodTypeAny>;
const createNetworkAclRuleShape = {
  listId: z.string().describe("ACL list identifier (UUID) to add the rule to."),
  cidrList: z.string().describe("CIDR(s) the rule matches."),
  protocol: z.string().describe('Protocol, e.g. "TCP", "UDP", "ICMP", or "ALL".'),
  action: z.string().describe('Action: "Allow" or "Deny".'),
  trafficType: z.string().describe('Traffic direction: "Ingress" or "Egress".'),
  number: z.string().optional().describe("Rule number / ordering (string)."),
  startPort: z.number().int().min(1).max(65535).optional().describe("Start port (1-65535)."),
  endPort: z.number().int().min(1).max(65535).optional().describe("End port (1-65535)."),
  icmpType: z.string().optional().describe("ICMP type (when protocol is ICMP)."),
  icmpCode: z.string().optional().describe("ICMP code (when protocol is ICMP)."),
} satisfies Record<keyof AmericancloudApi.CreateNetworkAclRuleDto, z.ZodTypeAny>;
const getNetworkAclRuleShape = {
  id: z.string().describe("ACL rule identifier (UUID), from list_network_acl_rules."),
} satisfies Record<keyof AmericancloudApi.GetRuleNetworkAclsRequest, z.ZodTypeAny>;
const deleteNetworkAclRuleShape = {
  id: z.string().describe("ACL rule identifier (UUID) to delete."),
} satisfies Record<keyof AmericancloudApi.DeleteRuleNetworkAclsRequest, z.ZodTypeAny>;
const replaceNetworkAclListShape = {
  id: z.string().describe("ACL list identifier (UUID) to apply."),
  networkId: z.string().describe("Network/tier UUID to apply the ACL list to."),
} satisfies Record<keyof AmericancloudApi.ReplaceNetworkAclListDto, z.ZodTypeAny>;

export const networkingTools: ToolDef[] = [
  // ── isolatedNetworks ──
  defineTool({ name: "list_isolated_networks", title: "List isolated networks", description: "List standalone isolated (single-tier private) networks in your account. VPC tier subnets are listed separately via get_vpc_network.", group: "networking", sdkRef: "isolatedNetworks.listIsolatedNetworks", readOnly: true, idempotent: true, inputSchema: listIsolatedNetworksShape, run: (c, a) => c.isolatedNetworks.listIsolatedNetworks(a) }),
  defineTool({ name: "create_isolated_network", title: "Create isolated network", description: "Create an isolated private network in a region. VMs and public IPs can be attached to it.", group: "networking", sdkRef: "isolatedNetworks.createIsolatedNetworks", readOnly: false, idempotent: false, inputSchema: createIsolatedNetworkShape, run: (c, a) => c.isolatedNetworks.createIsolatedNetworks(a) }),
  defineTool({ name: "get_isolated_network", title: "Get isolated network", description: "Get one standalone isolated network by ID, including its CIDR and status. If the ID belongs to a VPC tier subnet (e.g. from a VM in a VPC), use get_vpc_tier instead.", group: "networking", sdkRef: "isolatedNetworks.getIsolatedNetworks", readOnly: true, idempotent: true, inputSchema: getIsolatedNetworkShape, run: (c, a) => c.isolatedNetworks.getIsolatedNetworks(a) }),
  defineTool({ name: "update_isolated_network", title: "Update isolated network", description: "Update an isolated network's name or description.", group: "networking", sdkRef: "isolatedNetworks.updateIsolatedNetworks", readOnly: false, idempotent: true, inputSchema: updateIsolatedNetworkShape, run: (c, a) => c.isolatedNetworks.updateIsolatedNetworks(a) }),
  defineTool({ name: "delete_isolated_network", title: "Delete isolated network", description: "Permanently delete an isolated network. Detach any VMs and release its public IPs first; if those are still releasing, the delete can transiently fail with a conflict (409) or gateway timeout (504) — retry until it succeeds or the network is no longer found. Cannot be undone.", group: "networking", sdkRef: "isolatedNetworks.deleteIsolatedNetworks", readOnly: false, destructive: true, idempotent: true, inputSchema: deleteIsolatedNetworkShape, run: (c, a) => c.isolatedNetworks.deleteIsolatedNetworks(a) }),
  defineTool({ name: "restart_isolated_network", title: "Restart isolated network", description: "Restart an isolated network's virtual router. Briefly disrupts connectivity; reversible.", group: "networking", sdkRef: "isolatedNetworks.restartIsolatedNetworks", readOnly: false, idempotent: false, inputSchema: restartIsolatedNetworkShape, run: (c, a) => c.isolatedNetworks.restartIsolatedNetworks(a) }),

  // ── vpcNetworks ──
  defineTool({ name: "list_vpc_networks", title: "List VPC networks", description: "List Virtual Private Cloud networks, which contain multiple tier subnets.", group: "networking", sdkRef: "vpcNetworks.listVpcNetworks", readOnly: true, idempotent: true, inputSchema: listVpcNetworksShape, run: (c, a) => c.vpcNetworks.listVpcNetworks(a) }),
  defineTool({ name: "create_vpc_network", title: "Create VPC network", description: "Create a VPC network with a CIDR block. Add tier subnets with create_vpc_tier. Preview cost with get_cost_estimate_vpc_network.", group: "networking", sdkRef: "vpcNetworks.createVpcNetworks", readOnly: false, idempotent: false, inputSchema: createVpcNetworkShape, run: (c, a) => c.vpcNetworks.createVpcNetworks(a) }),
  defineTool({ name: "get_vpc_network", title: "Get VPC network", description: "Get one VPC network by ID, including its tiers and status.", group: "networking", sdkRef: "vpcNetworks.getVpcNetworks", readOnly: true, idempotent: true, inputSchema: getVpcNetworkShape, run: (c, a) => c.vpcNetworks.getVpcNetworks(a) }),
  defineTool({ name: "update_vpc_network", title: "Update VPC network", description: "Update a VPC network's name or description.", group: "networking", sdkRef: "vpcNetworks.updateVpcNetworks", readOnly: false, idempotent: true, inputSchema: updateVpcNetworkShape, run: (c, a) => c.vpcNetworks.updateVpcNetworks(a) }),
  defineTool({ name: "delete_vpc_network", title: "Delete VPC network", description: "Permanently delete a VPC network and its tiers. Cannot be undone.", group: "networking", sdkRef: "vpcNetworks.deleteVpcNetworks", readOnly: false, destructive: true, idempotent: true, inputSchema: deleteVpcNetworkShape, run: (c, a) => c.vpcNetworks.deleteVpcNetworks(a) }),
  defineTool({ name: "get_cost_estimate_vpc_network", title: "Get VPC cost estimate", description: "Preview the price of a VPC configuration without creating it. Same arguments as create_vpc_network.", group: "networking", sdkRef: "vpcNetworks.getCostEstimateVpcNetworks", readOnly: true, idempotent: true, inputSchema: createVpcNetworkShape, run: (c, a) => c.vpcNetworks.getCostEstimateVpcNetworks(a) }),
  defineTool({ name: "create_vpc_tier", title: "Create VPC tier", description: "Create a tier (subnet) inside a VPC, optionally with a network ACL list applied.", group: "networking", sdkRef: "vpcNetworks.createTierVpcNetworks", readOnly: false, idempotent: false, inputSchema: createVpcTierShape, run: (c, a) => c.vpcNetworks.createTierVpcNetworks(a) }),
  defineTool({ name: "get_vpc_tier", title: "Get VPC tier", description: "Get one tier (subnet) of a VPC, including its CIDR, gateway, ACL, status, and creation date. Use the tier IDs from get_vpc_network.", group: "networking", sdkRef: "vpcNetworks.getTierVpcNetworks", readOnly: true, idempotent: true, inputSchema: getVpcTierShape, run: (c, a) => c.vpcNetworks.getTierVpcNetworks(a) }),
  defineTool({ name: "update_vpc_tier", title: "Update VPC tier", description: "Update a VPC tier's name or description. To change its ACL, use replace_network_acl_list instead.", group: "networking", sdkRef: "vpcNetworks.updateTierVpcNetworks", readOnly: false, idempotent: true, inputSchema: updateVpcTierShape, run: (c, a) => c.vpcNetworks.updateTierVpcNetworks(a) }),
  defineTool({ name: "restart_vpc_tier", title: "Restart VPC tier", description: "Restart a single tier (subnet) of a VPC. Briefly disrupts connectivity on that tier; reversible.", group: "networking", sdkRef: "vpcNetworks.restartTierVpcNetworks", readOnly: false, idempotent: false, inputSchema: restartVpcTierShape, run: (c, a) => c.vpcNetworks.restartTierVpcNetworks(a) }),
  defineTool({ name: "delete_vpc_tier", title: "Delete VPC tier", description: "Delete a single tier (subnet) from a VPC, leaving the VPC and its other tiers in place. Cannot be undone. Use the tier IDs from get_vpc_network.", group: "networking", sdkRef: "vpcNetworks.deleteTierVpcNetworks", readOnly: false, destructive: true, idempotent: true, inputSchema: deleteVpcTierShape, run: (c, a) => c.vpcNetworks.deleteTierVpcNetworks(a) }),
  defineTool({ name: "restart_vpc_network", title: "Restart VPC network", description: "Restart a VPC's virtual router. Briefly disrupts connectivity; reversible.", group: "networking", sdkRef: "vpcNetworks.restartVpcNetworks", readOnly: false, idempotent: false, inputSchema: restartVpcNetworkShape, run: (c, a) => c.vpcNetworks.restartVpcNetworks(a) }),

  // ── publicIps ──
  defineTool({ name: "list_public_ips", title: "List public IPs", description: "List the public IP addresses allocated to your account.", group: "networking", sdkRef: "publicIps.listPublicIps", readOnly: true, idempotent: true, inputSchema: listPublicIpsShape, run: (c, a) => c.publicIps.listPublicIps(a) }),
  defineTool({ name: "reserve_public_ip", title: "Reserve public IP", description: "Reserve a new public IP address in an isolated network or VPC.", group: "networking", sdkRef: "publicIps.reservePublicIps", readOnly: false, idempotent: false, inputSchema: reservePublicIpShape, run: (c, a) => c.publicIps.reservePublicIps(a) }),
  defineTool({ name: "list_public_ips_by_isolated_network", title: "List public IPs by isolated network", description: "List the public IPs allocated within a specific isolated network.", group: "networking", sdkRef: "publicIps.listByIsolatedNetworkPublicIps", readOnly: true, idempotent: true, inputSchema: listPublicIpsByIsolatedNetworkShape, run: (c, a) => c.publicIps.listByIsolatedNetworkPublicIps(a) }),
  defineTool({ name: "list_public_ips_by_vpc", title: "List public IPs by VPC", description: "List the public IPs allocated within a specific VPC.", group: "networking", sdkRef: "publicIps.listByVpcPublicIps", readOnly: true, idempotent: true, inputSchema: listPublicIpsByVpcShape, run: (c, a) => c.publicIps.listByVpcPublicIps(a) }),
  defineTool({ name: "get_public_ip", title: "Get public IP", description: "Get one public IP by ID, including its NAT configuration.", group: "networking", sdkRef: "publicIps.getPublicIps", readOnly: true, idempotent: true, inputSchema: getPublicIpShape, run: (c, a) => c.publicIps.getPublicIps(a) }),
  defineTool({ name: "release_public_ip", title: "Release public IP", description: "Release a public IP back to the pool. Any rules on it are removed and the address is lost. Cannot be undone.", group: "networking", sdkRef: "publicIps.releasePublicIps", readOnly: false, destructive: true, idempotent: true, inputSchema: releasePublicIpShape, run: (c, a) => c.publicIps.releasePublicIps(a) }),
  defineTool({ name: "get_cost_estimate_public_ip", title: "Get public IP cost estimate", description: "Get the price of a public IP address. Takes no arguments.", group: "networking", sdkRef: "publicIps.getCostEstimatePublicIps", readOnly: true, idempotent: true, inputSchema: {}, run: (c) => c.publicIps.getCostEstimatePublicIps() }),
  defineTool({ name: "change_source_nat_ip", title: "Change source NAT IP", description: "Make a public IP the source NAT (outbound) IP for a network.", group: "networking", sdkRef: "publicIps.changeSourceNatIpPublicIps", readOnly: false, idempotent: true, inputSchema: changeSourceNatIpShape, run: (c, a) => c.publicIps.changeSourceNatIpPublicIps(a) }),
  defineTool({ name: "enable_static_nat", title: "Enable static NAT", description: "Map a public IP one-to-one to a VM (static NAT), so the VM is reachable on that IP.", group: "networking", sdkRef: "publicIps.enableStaticNatPublicIps", readOnly: false, idempotent: true, inputSchema: enableStaticNatShape, run: (c, a) => c.publicIps.enableStaticNatPublicIps(a) }),
  defineTool({ name: "disable_static_nat", title: "Disable static NAT", description: "Remove the static NAT mapping from a public IP.", group: "networking", sdkRef: "publicIps.disableStaticNatPublicIps", readOnly: false, idempotent: true, inputSchema: disableStaticNatShape, run: (c, a) => c.publicIps.disableStaticNatPublicIps(a) }),

  // ── firewallRules ──
  defineTool({ name: "list_firewall_rules", title: "List firewall rules", description: "List inbound firewall rules on a public IP.", group: "networking", sdkRef: "firewallRules.listFirewallRules", readOnly: true, idempotent: true, inputSchema: listFirewallRulesShape, run: (c, a) => c.firewallRules.listFirewallRules(a) }),
  defineTool({ name: "create_firewall_rule", title: "Create firewall rule", description: "Create an inbound firewall rule on a public IP, allowing traffic on a protocol/port range from a source CIDR.", group: "networking", sdkRef: "firewallRules.createFirewallRules", readOnly: false, idempotent: false, inputSchema: createFirewallRuleShape, run: (c, a) => c.firewallRules.createFirewallRules(a) }),
  defineTool({ name: "delete_firewall_rule", title: "Delete firewall rule", description: "Delete a firewall rule by ID. Cannot be undone.", group: "networking", sdkRef: "firewallRules.deleteFirewallRules", readOnly: false, destructive: true, idempotent: true, inputSchema: deleteFirewallRuleShape, run: (c, a) => c.firewallRules.deleteFirewallRules(a) }),

  // ── portForwarding ──
  defineTool({ name: "list_port_forwarding_rules", title: "List port forwarding rules", description: "List port forwarding rules on a public IP.", group: "networking", sdkRef: "portForwarding.listPortForwarding", readOnly: true, idempotent: true, inputSchema: listPortForwardingShape, run: (c, a) => c.portForwarding.listPortForwarding(a) }),
  defineTool({ name: "create_port_forwarding_rule", title: "Create port forwarding rule", description: "Forward a public port on a public IP to a private port on a VM.", group: "networking", sdkRef: "portForwarding.createPortForwarding", readOnly: false, idempotent: false, inputSchema: createPortForwardingRuleShape, run: (c, a) => c.portForwarding.createPortForwarding(a) }),
  defineTool({ name: "delete_port_forwarding_rule", title: "Delete port forwarding rule", description: "Delete a port forwarding rule by ID. Cannot be undone.", group: "networking", sdkRef: "portForwarding.deletePortForwarding", readOnly: false, destructive: true, idempotent: true, inputSchema: deletePortForwardingRuleShape, run: (c, a) => c.portForwarding.deletePortForwarding(a) }),

  // ── loadBalancerRules ──
  defineTool({ name: "list_load_balancer_rules", title: "List load balancer rules", description: "List load balancer rules on a public IP.", group: "networking", sdkRef: "loadBalancerRules.listLoadBalancerRules", readOnly: true, idempotent: true, inputSchema: listLoadBalancerRulesShape, run: (c, a) => c.loadBalancerRules.listLoadBalancerRules(a) }),
  defineTool({ name: "create_load_balancer_rule", title: "Create load balancer rule", description: "Create a load balancer rule on a public IP. Assign backend VMs with assign_vms_to_load_balancer.", group: "networking", sdkRef: "loadBalancerRules.createLoadBalancerRules", readOnly: false, idempotent: false, inputSchema: createLoadBalancerRuleShape, run: (c, a) => c.loadBalancerRules.createLoadBalancerRules(a) }),
  defineTool({ name: "update_load_balancer_rule", title: "Update load balancer rule", description: "Update a load balancer rule's name, algorithm, protocol, source CIDR, or description.", group: "networking", sdkRef: "loadBalancerRules.updateLoadBalancerRules", readOnly: false, idempotent: true, inputSchema: updateLoadBalancerRuleShape, run: (c, a) => c.loadBalancerRules.updateLoadBalancerRules(a) }),
  defineTool({ name: "delete_load_balancer_rule", title: "Delete load balancer rule", description: "Delete a load balancer rule by ID. Cannot be undone.", group: "networking", sdkRef: "loadBalancerRules.deleteLoadBalancerRules", readOnly: false, destructive: true, idempotent: true, inputSchema: deleteLoadBalancerRuleShape, run: (c, a) => c.loadBalancerRules.deleteLoadBalancerRules(a) }),
  defineTool({ name: "list_load_balancer_instances", title: "List load balancer instances", description: "List the VMs assigned (or assignable) to a load balancer rule.", group: "networking", sdkRef: "loadBalancerRules.listInstancesLoadBalancerRules", readOnly: true, idempotent: true, inputSchema: listLoadBalancerInstancesShape, run: (c, a) => c.loadBalancerRules.listInstancesLoadBalancerRules(a) }),
  defineTool({ name: "assign_vms_to_load_balancer", title: "Assign VMs to load balancer", description: "Add backend VMs to a load balancer rule.", group: "networking", sdkRef: "loadBalancerRules.assignVmsLoadBalancerRules", readOnly: false, idempotent: true, inputSchema: assignVmsToLoadBalancerShape, run: (c, a) => c.loadBalancerRules.assignVmsLoadBalancerRules({ ruleId: a.ruleId, body: { vmIds: a.vmIds } }) }),
  defineTool({ name: "remove_vms_from_load_balancer", title: "Remove VMs from load balancer", description: "Remove backend VMs from a load balancer rule.", group: "networking", sdkRef: "loadBalancerRules.removeVmsLoadBalancerRules", readOnly: false, idempotent: true, inputSchema: removeVmsFromLoadBalancerShape, run: (c, a) => c.loadBalancerRules.removeVmsLoadBalancerRules({ ruleId: a.ruleId, body: { vmIds: a.vmIds } }) }),

  // ── egressRules ──
  defineTool({ name: "list_egress_rules", title: "List egress rules", description: "List outbound (egress) traffic rules across your isolated networks.", group: "networking", sdkRef: "egressRules.listEgressRules", readOnly: true, idempotent: true, inputSchema: listEgressRulesShape, run: (c, a) => c.egressRules.listEgressRules(a) }),
  defineTool({ name: "create_egress_rule", title: "Create egress rule", description: "Create an outbound (egress) rule for an isolated network. sourceCidrList is the source within the network's CIDR.", group: "networking", sdkRef: "egressRules.createEgressRules", readOnly: false, idempotent: false, inputSchema: createEgressRuleShape, run: (c, a) => c.egressRules.createEgressRules(a) }),
  defineTool({ name: "list_egress_rules_by_network", title: "List egress rules by network", description: "List the egress rules for a specific isolated network.", group: "networking", sdkRef: "egressRules.listByNetworkEgressRules", readOnly: true, idempotent: true, inputSchema: listEgressRulesByNetworkShape, run: (c, a) => c.egressRules.listByNetworkEgressRules(a) }),
  defineTool({ name: "get_egress_rule", title: "Get egress rule", description: "Get one egress rule by ID (from list_egress_rules), including its protocol, ports, and CIDRs.", group: "networking", sdkRef: "egressRules.getEgressRules", readOnly: true, idempotent: true, inputSchema: getEgressRuleShape, run: (c, a) => c.egressRules.getEgressRules(a) }),
  defineTool({ name: "update_egress_rule", title: "Update egress rule", description: "Update an egress rule's CIDRs or port range.", group: "networking", sdkRef: "egressRules.updateEgressRules", readOnly: false, idempotent: true, inputSchema: updateEgressRuleShape, run: (c, a) => c.egressRules.updateEgressRules(a) }),
  defineTool({ name: "delete_egress_rule", title: "Delete egress rule", description: "Delete an egress rule by ID. Cannot be undone.", group: "networking", sdkRef: "egressRules.deleteEgressRules", readOnly: false, destructive: true, idempotent: true, inputSchema: deleteEgressRuleShape, run: (c, a) => c.egressRules.deleteEgressRules(a) }),

  // ── networkAcls ──
  defineTool({ name: "list_network_acl_lists", title: "List network ACL lists", description: "List network ACL lists, which are applied to VPC tiers.", group: "networking", sdkRef: "networkAcls.listListsNetworkAcls", readOnly: true, idempotent: true, inputSchema: listNetworkAclListsShape, run: (c, a) => c.networkAcls.listListsNetworkAcls(a) }),
  defineTool({ name: "create_network_acl_list", title: "Create network ACL list", description: "Create a network ACL list in a VPC. Add rules with create_network_acl_rule, then apply it to a tier.", group: "networking", sdkRef: "networkAcls.createListNetworkAcls", readOnly: false, idempotent: false, inputSchema: createNetworkAclListShape, run: (c, a) => c.networkAcls.createListNetworkAcls(a) }),
  defineTool({ name: "list_network_acl_lists_by_vpc", title: "List network ACL lists by VPC", description: "List the ACL lists belonging to a specific VPC.", group: "networking", sdkRef: "networkAcls.listListsByVpcNetworkAcls", readOnly: true, idempotent: true, inputSchema: listNetworkAclListsByVpcShape, run: (c, a) => c.networkAcls.listListsByVpcNetworkAcls(a) }),
  defineTool({ name: "get_network_acl_list", title: "Get network ACL list", description: "Get one network ACL list by ID.", group: "networking", sdkRef: "networkAcls.getListNetworkAcls", readOnly: true, idempotent: true, inputSchema: getNetworkAclListShape, run: (c, a) => c.networkAcls.getListNetworkAcls(a) }),
  defineTool({ name: "delete_network_acl_list", title: "Delete network ACL list", description: "Delete a network ACL list and its rules. Cannot be undone.", group: "networking", sdkRef: "networkAcls.deleteListNetworkAcls", readOnly: false, destructive: true, idempotent: true, inputSchema: deleteNetworkAclListShape, run: (c, a) => c.networkAcls.deleteListNetworkAcls(a) }),
  defineTool({ name: "list_network_acl_rules", title: "List network ACL rules", description: "List the rules within a network ACL list.", group: "networking", sdkRef: "networkAcls.listRulesNetworkAcls", readOnly: true, idempotent: true, inputSchema: listNetworkAclRulesShape, run: (c, a) => c.networkAcls.listRulesNetworkAcls(a) }),
  defineTool({ name: "create_network_acl_rule", title: "Create network ACL rule", description: "Add a rule to a network ACL list, allowing or denying traffic by protocol, port range, and CIDR.", group: "networking", sdkRef: "networkAcls.createRuleNetworkAcls", readOnly: false, idempotent: false, inputSchema: createNetworkAclRuleShape, run: (c, a) => c.networkAcls.createRuleNetworkAcls(a) }),
  defineTool({ name: "get_network_acl_rule", title: "Get network ACL rule", description: "Get one network ACL rule by ID.", group: "networking", sdkRef: "networkAcls.getRuleNetworkAcls", readOnly: true, idempotent: true, inputSchema: getNetworkAclRuleShape, run: (c, a) => c.networkAcls.getRuleNetworkAcls(a) }),
  defineTool({ name: "delete_network_acl_rule", title: "Delete network ACL rule", description: "Delete a network ACL rule by ID. Cannot be undone.", group: "networking", sdkRef: "networkAcls.deleteRuleNetworkAcls", readOnly: false, destructive: true, idempotent: true, inputSchema: deleteNetworkAclRuleShape, run: (c, a) => c.networkAcls.deleteRuleNetworkAcls(a) }),
  defineTool({ name: "replace_network_acl_list", title: "Replace network ACL list", description: "Apply (replace) the network ACL list on a VPC tier with the given list.", group: "networking", sdkRef: "networkAcls.replaceListNetworkAcls", readOnly: false, idempotent: true, inputSchema: replaceNetworkAclListShape, run: (c, a) => c.networkAcls.replaceListNetworkAcls(a) }),
];
