// Stable IDs are shared by local settings, backups and synchronization.
export const paletteIds = ["basic", "original", "ruby", "coral", "terracotta", "amber", "honey", "olive", "lime", "moss", "sage", "pine", "jade", "mint", "teal", "lagoon", "cyan", "ice", "sky", "ocean", "cobalt", "indigo", "iris", "violet", "lavender", "plum", "orchid", "magenta", "rose", "blush", "cocoa", "sand", "slate"] as const;
export type PaletteId = typeof paletteIds[number];
export const paletteId = (value?: string): PaletteId => paletteIds.find(id => id === value) ?? 'basic';
export const appearanceMode = (value?: string) => value === 'dark' || value === 'light' ? value : 'system';
// Presentation order is independent of saved IDs and locale name indices.
export const paletteOrder = ['basic', 'original', 'ruby', 'coral', 'terracotta', 'cocoa', 'amber', 'sand', 'honey', 'olive', 'lime', 'moss', 'sage', 'pine', 'jade', 'mint', 'teal', 'lagoon', 'cyan', 'ice', 'sky', 'slate', 'ocean', 'cobalt', 'indigo', 'iris', 'violet', 'lavender', 'plum', 'orchid', 'magenta', 'rose', 'blush'] as const satisfies readonly PaletteId[];
export const appearanceCacheKey = 'lingfern-appearance-v1';

export function applyAppearance(mode: string, palette: PaletteId) {
  document.documentElement.dataset.theme = mode;
  document.documentElement.dataset.palette = palette;
  delete document.documentElement.dataset.appearancePending;
  // This cache only bridges the first paint until IndexedDB has been read.
  try { localStorage.setItem(appearanceCacheKey, JSON.stringify({ mode, palette })); } catch { /* IndexedDB remains authoritative. */ }
}
