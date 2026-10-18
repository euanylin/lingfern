import { z } from 'zod';

export const cataloguePath = '/resources/catalogue.json';
export const catalogueCacheName = 'lingfern-resource-catalogue';
export const catalogueMaxBytes = 2 * 1024 * 1024;
export const resourceMaxBytes = 25 * 1024 * 1024;
const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/);
const version = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/);
const bytes = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const publicResourcePathSchema = z.string().max(1024).refine(path => {
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(path)) return false;
  const parts = path.slice(1).split('/');
  if (!/^(?:dictionary|ipa|grammar|corpus|audio|packs|source-packs|resources)$/.test(parts[0])) return false;
  return !parts.some(part => part === '.' || part === '..' || part.startsWith('.')) &&
    !/^(?:api|oauth|mcp|private|users?|profiles?|accounts?|sessions?|backups?|learners?|research|credentials?|secrets?|config|\.well-known)$/i.test(parts[0]);
}, 'PUBLIC_RESOURCE_PATH');
const file = z.object({ path: publicResourcePathSchema, bytes: bytes.max(resourceMaxBytes), sha256: hash }).strict();
const group = z.object({ id, version, bytes, files: z.array(file).min(1).max(20000) }).strict();
const sourcePack = z.object({
  id, topic: id, title: z.object({ 'zh-Hans': z.string().min(1).max(200), 'zh-Hant': z.string().min(1).max(200), en: z.string().min(1).max(200) }).strict(),
  skill: z.enum(['reading', 'listening']), bytes: bytes.max(resourceMaxBytes), sha256: hash, roots: bytes,
  clips: bytes.optional(), passages: bytes.optional(), sourceFamilies: z.array(id).min(1).max(100), path: publicResourcePathSchema,
  minWords: bytes.nullable(), minSeconds: z.number().finite().nonnegative().nullable(),
  expandedBytes: bytes, mediaBytes: bytes, metadataBytes: bytes, audioSeconds: z.number().finite().nonnegative(),
}).strict();
const download = z.object({ id, version, path: publicResourcePathSchema, bytes: bytes.max(resourceMaxBytes), sha256: hash }).strict();
export const resourceCatalogueSchema = z.object({
  version: z.literal(1), offline: z.object({ version, groups: z.array(group).max(10000) }).strict(),
  sources: z.object({ version: z.literal(1), packs: z.array(sourcePack).max(10000) }).strict(),
  downloads: z.object({ version: z.literal(1), packs: z.array(download).max(10000) }).strict(),
}).strict().superRefine((value, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
  const unique = (items: string[]) => new Set(items).size === items.length;
  if (!unique([...value.offline.groups.map(x => x.id), ...value.sources.packs.map(x => x.id)]) || !unique(value.downloads.packs.map(x => x.id))) fail('DUPLICATE_RESOURCE_ID');
  const paths = [...value.offline.groups.flatMap(x => x.files.map(f => f.path)), ...value.sources.packs.map(x => x.path), ...value.downloads.packs.map(x => x.path)];
  if (!unique(paths) || paths.includes(cataloguePath)) fail('DUPLICATE_RESOURCE_PATH');
  for (const item of value.offline.groups) if (item.bytes !== item.files.reduce((sum, f) => sum + f.bytes, 0)) fail('RESOURCE_BYTES');
  for (const item of value.sources.packs) {
    if (item.expandedBytes !== item.mediaBytes + item.metadataBytes || !unique(item.sourceFamilies)) fail('SOURCE_METADATA');
    if (item.skill === 'reading' ? item.passages === undefined || item.clips !== undefined || item.mediaBytes !== 0 || item.audioSeconds !== 0 : item.clips === undefined || item.passages !== undefined) fail('SOURCE_SKILL_METADATA');
  }
  for (const item of value.downloads.packs) if (!value.offline.groups.some(x => x.id === item.id && x.version === item.version)) fail('UNKNOWN_DOWNLOAD_GROUP');
});
export type ResourceCatalogue = z.infer<typeof resourceCatalogueSchema>;
