/**
 * DNS group: dnsZones, dnsRecords.
 */
import { z } from "zod";
import type { AmericancloudApi, AmericancloudApiClient } from "@americancloud/sdk";
import { defineTool, type ToolDef } from "../tooldef.js";
import { pagination } from "../schemas.js";

// CreateRecordDto / UpdateRecordDto are interface+namespace merged (they carry
// the record-type enum), so derive them from the client method signatures
// (avoids TS2749 — interface+namespace merged DTO).
type CreateRecordDto = Parameters<AmericancloudApiClient["dnsRecords"]["createDnsRecords"]>[0];
type UpdateRecordDto = Parameters<AmericancloudApiClient["dnsRecords"]["updateDnsRecords"]>[0];

const RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "NS", "SRV", "TXT"] as const;
const recordType = z.enum(RECORD_TYPES).describe("DNS record type.");

const ttl = z
  .number()
  .int()
  .min(60)
  .max(86400)
  .optional()
  .describe("Time to live in seconds (60–86400). Omit to use the zone default.");
const priority = z
  .number()
  .int()
  .optional()
  .describe("Priority. Required for MX and SRV records; ignored otherwise.");
const weight = z.number().int().optional().describe("Weight. Required for SRV records.");
const port = z.number().int().optional().describe("Port. Required for SRV records.");

// ── zone shapes ────────────────────────────────────────────────────────────
const listDnsZonesShape = {
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListDnsZonesRequest, z.ZodTypeAny>;

const createDnsZoneShape = {
  name: z.string().min(1).describe('Domain name for the zone, e.g. "example.com".'),
} satisfies Record<keyof AmericancloudApi.CreateZoneDto, z.ZodTypeAny>;

const deleteDnsZoneShape = {
  id: z.string().describe("DNS zone identifier (UUID), from list_dns_zones."),
} satisfies Record<keyof AmericancloudApi.DeleteDnsZonesRequest, z.ZodTypeAny>;

// ── record shapes ──────────────────────────────────────────────────────────
const listDnsRecordsShape = {
  zoneId: z.string().describe("DNS zone identifier (UUID) whose records to list."),
  ...pagination,
} satisfies Record<keyof AmericancloudApi.ListDnsRecordsRequest, z.ZodTypeAny>;

const createDnsRecordShape = {
  zoneId: z.string().describe("DNS zone identifier (UUID) the record belongs to."),
  name: z
    .string()
    .describe('Hostname relative to the zone. Use "@" for the zone apex (e.g. "www" or "@").'),
  type: recordType,
  content: z
    .string()
    .describe("Record value: an IP for A/AAAA, a hostname for CNAME/NS/MX, or text for TXT."),
  ttl,
  priority,
  weight,
  port,
} satisfies Record<keyof CreateRecordDto, z.ZodTypeAny>;

type _CheckCreateRecord =
  z.infer<z.ZodObject<typeof createDnsRecordShape>> extends CreateRecordDto ? true : never;
const _checkCreateRecord: _CheckCreateRecord = true;
void _checkCreateRecord;

const updateDnsRecordShape = {
  zoneId: z.string().describe("DNS zone identifier (UUID)."),
  currentName: z
    .string()
    .describe('Existing hostname identifying the record to update (use "@" for apex).'),
  currentType: recordType.describe("Existing record type identifying the record to update."),
  name: z.string().describe('New hostname for the record (use "@" for apex).'),
  type: recordType.describe("New record type."),
  content: z.string().describe("New record value."),
  ttl,
  priority,
  weight,
  port,
} satisfies Record<keyof UpdateRecordDto, z.ZodTypeAny>;

type _CheckUpdateRecord =
  z.infer<z.ZodObject<typeof updateDnsRecordShape>> extends UpdateRecordDto ? true : never;
const _checkUpdateRecord: _CheckUpdateRecord = true;
void _checkUpdateRecord;

const deleteDnsRecordShape = {
  zoneId: z.string().describe("DNS zone identifier (UUID)."),
  name: z.string().describe('Record hostname to delete (use "@" for apex).'),
  type: recordType.describe("Record type to delete."),
  content: z
    .string()
    .optional()
    .describe(
      "Specific value to remove. Provide to delete one entry from a multi-value MX/NS/TXT set; omit to delete all values for this name and type.",
    ),
} satisfies Record<keyof AmericancloudApi.DeleteRecordBody, z.ZodTypeAny>;

export const dnsTools: ToolDef[] = [
  defineTool({
    name: "list_dns_zones",
    title: "List DNS zones",
    description:
      "List the hosted DNS zones (domains) in your account with their IDs and names. Use a zone ID with the DNS record tools.",
    group: "dns",
    sdkRef: "dnsZones.listDnsZones",
    readOnly: true,
    idempotent: true,
    inputSchema: listDnsZonesShape,
    run: (client, args) => client.dnsZones.listDnsZones(args),
  }),
  defineTool({
    name: "create_dns_zone",
    title: "Create DNS zone",
    description:
      'Create a hosted DNS zone for a domain you own (e.g. "example.com"). After creating it, add records with create_dns_record.',
    group: "dns",
    sdkRef: "dnsZones.createDnsZones",
    readOnly: false,
    idempotent: false,
    inputSchema: createDnsZoneShape,
    run: (client, args) => client.dnsZones.createDnsZones(args),
  }),
  defineTool({
    name: "delete_dns_zone",
    title: "Delete DNS zone",
    description:
      "Permanently delete a DNS zone and all of its records. This breaks DNS resolution for the domain and cannot be undone. Requires the zone ID from list_dns_zones.",
    group: "dns",
    sdkRef: "dnsZones.deleteDnsZones",
    readOnly: false,
    destructive: true,
    idempotent: true,
    inputSchema: deleteDnsZoneShape,
    run: (client, args) => client.dnsZones.deleteDnsZones(args),
  }),
  defineTool({
    name: "list_dns_records",
    title: "List DNS records",
    description:
      "List the DNS records in a zone (name, type, content, TTL). Requires the zone ID from list_dns_zones.",
    group: "dns",
    sdkRef: "dnsRecords.listDnsRecords",
    readOnly: true,
    idempotent: true,
    inputSchema: listDnsRecordsShape,
    run: (client, args) => client.dnsRecords.listDnsRecords(args),
  }),
  defineTool({
    name: "create_dns_record",
    title: "Create DNS record",
    description:
      'Create a DNS record in a zone (A, AAAA, CNAME, MX, NS, SRV, TXT). Use "@" as the name for the zone apex. MX and SRV require priority; SRV also requires weight and port.',
    group: "dns",
    sdkRef: "dnsRecords.createDnsRecords",
    readOnly: false,
    idempotent: false,
    inputSchema: createDnsRecordShape,
    run: (client, args) => client.dnsRecords.createDnsRecords(args),
  }),
  defineTool({
    name: "update_dns_record",
    title: "Update DNS record",
    description:
      "Update an existing DNS record. Identify the record to change with currentName + currentType, then supply the new name, type, content, and optional ttl/priority/weight/port. Requires the zone ID.",
    group: "dns",
    sdkRef: "dnsRecords.updateDnsRecords",
    readOnly: false,
    idempotent: true,
    inputSchema: updateDnsRecordShape,
    run: (client, args) => client.dnsRecords.updateDnsRecords(args),
  }),
  defineTool({
    name: "delete_dns_record",
    title: "Delete DNS record",
    description:
      "Delete a DNS record from a zone by name and type. For multi-value sets (MX/NS/TXT), pass content to remove a single entry; omit content to remove all values for that name and type. Cannot be undone.",
    group: "dns",
    sdkRef: "dnsRecords.deleteDnsRecords",
    readOnly: false,
    destructive: true,
    idempotent: true,
    inputSchema: deleteDnsRecordShape,
    run: (client, args) => client.dnsRecords.deleteDnsRecords(args),
  }),
];
