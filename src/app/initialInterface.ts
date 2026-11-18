import { appearanceMode, paletteId, type PaletteId } from '../shared/palettes';
import { db, profiles, settings } from '../data/db';
import { localeSchema, type Locale } from '../shared/locale';

export type NavDisplay = 'text' | 'icon' | 'both';
export const navDisplay = (value?: string): value is NavDisplay => value === 'text' || value === 'icon' || value === 'both';
export type InitialInterface = { locale: Locale; theme: string; palette: PaletteId; desktopNavDisplay: NavDisplay; mobileNavDisplay: NavDisplay };
export const defaultInterface = (locale: Locale): InitialInterface => ({ locale, theme: 'system', palette: 'basic', desktopNavDisplay: 'text', mobileNavDisplay: 'both' });

// Read presentation settings together before the first client paint; never save defaults.
export async function readInitialInterface(fallback: Locale): Promise<InitialInterface> {
  return db.transaction('r', profiles, settings, async () => {
    const selected = (await settings.get('activeProfile'))?.value;
    const profile = (selected ? await profiles.get(selected) : undefined) ?? await profiles.toCollection().first();
    if (!profile) return defaultInterface(fallback);
    const [language, theme, desktop, mobile, palette] = await settings.bulkGet(['locale', 'theme', 'desktopNavDisplay', 'mobileNavDisplay', 'palette'].map(key => `profile:${profile.id}:${key}`));
    const locale = localeSchema.safeParse(language?.value);
    return {
      locale: locale.success ? locale.data : fallback,
      theme: appearanceMode(theme?.value),
      palette: paletteId(palette?.value),
      desktopNavDisplay: navDisplay(desktop?.value) ? desktop.value : 'text',
      mobileNavDisplay: navDisplay(mobile?.value) ? mobile.value : 'both',
    };
  });
}
