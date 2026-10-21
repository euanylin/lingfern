declare const __LINGFERN_RULE_HASHES__: { scoring: string; generator: string };
declare const __LINGFERN_IPA_WORD_SOURCES__: Pick<typeof import('../public/ipa/SOURCES.json')[number], 'word' | 'source' | 'author' | 'license' | 'licenseUrl' | 'changes'>[];
declare const __LINGFERN_IPA_SOUND_SOURCES__: Pick<typeof import('../public/ipa/PHONEME_SOURCES.json')[number], 'ipa' | 'source' | 'author' | 'license' | 'licenseUrl' | 'changes'>[];

declare const __LINGFERN_SOURCE_TOPICS__: { rootId: string; sourceHash: string; topic: import('./shared/preferences').Preferences['interests'][number] }[];
