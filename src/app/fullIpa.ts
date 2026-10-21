// IPA Chart (2026), adapted by Lingfern, CC BY-SA 4.0. See docs/ipa-classification.md.
export const fullVowels = [
  { height: 'Close', y: 8, cells: [[10, 'i', 'y'], [51, 'ɨ', 'ʉ'], [91, 'ɯ', 'u']] },
  { height: 'Near-close', y: 22, cells: [[29, 'ɪ', 'ʏ'], [80, null, 'ʊ']] },
  { height: 'Close-mid', y: 36, cells: [[23, 'e', 'ø'], [58, 'ɘ', 'ɵ'], [91, 'ɤ', 'o']] },
  { height: 'Mid', y: 50, cells: [[62, 'ə', null]] },
  { height: 'Open-mid', y: 64, cells: [[36, 'ɛ', 'œ'], [65, 'ɜ', 'ɞ'], [91, 'ʌ', 'ɔ']] },
  { height: 'Near-open', y: 78, cells: [[42, 'æ', null], [68, 'ɐ', null]] },
  { height: 'Open', y: 92, cells: [[49, 'a', 'ɶ'], [91, 'ɑ', 'ɒ']] },
] as const;
export const fullPlaces = ['Bilabial', 'Labiodental', 'Dental', 'Alveolar', 'Postalveolar', 'Retroflex', 'Palatal', 'Velar', 'Uvular', 'Pharyngeal', 'Glottal'];
// A dash means impossible articulation; an empty slot means unspecified.
export const fullConsonants = [
  ['Plosive', ['p','b'], [], [], ['t','d'], [], ['ʈ','ɖ'], ['c','ɟ'], ['k','ɡ'], ['q','ɢ'], ['—','—'], ['ʔ','—']],
  ['Nasal', [null,'m'], [null,'ɱ'], [], [null,'n'], [], [null,'ɳ'], [null,'ɲ'], [null,'ŋ'], [null,'ɴ'], ['—','—'], ['—','—']],
  ['Trill', [null,'ʙ'], [], [], [null,'r'], [], [], [], ['—','—'], [null,'ʀ'], [], ['—','—']],
  ['Tap or flap', [], [null,'ⱱ'], [], [null,'ɾ'], [], [null,'ɽ'], [], ['—','—'], [], [], ['—','—']],
  ['Fricative', ['ɸ','β'], ['f','v'], ['θ','ð'], ['s','z'], ['ʃ','ʒ'], ['ʂ','ʐ'], ['ç','ʝ'], ['x','ɣ'], ['χ','ʁ'], ['ħ','ʕ'], ['h','ɦ']],
  ['Lateral fricative', ['—','—'], ['—','—'], [], ['ɬ','ɮ'], [], [], [], [], [], ['—','—'], ['—','—']],
  ['Approximant', [], [null,'ʋ'], [], [null,'ɹ'], [], [null,'ɻ'], [null,'j'], [null,'ɰ'], [], [], ['—','—']],
  ['Lateral approximant', ['—','—'], ['—','—'], [], [null,'l'], [], [null,'ɭ'], [null,'ʎ'], [null,'ʟ'], [], ['—','—'], ['—','—']],
] as const;
export const otherSymbols = [
 ['ʍ','Voiceless labial-velar fricative'], ['w','Voiced labial-velar approximant'], ['ɥ','Voiced labial-palatal approximant'], ['ʜ','Voiceless epiglottal fricative'], ['ʢ','Voiced epiglottal fricative'], ['ʡ','Epiglottal plosive'], ['ɕ','Voiceless alveolo-palatal fricative'], ['ʑ','Voiced alveolo-palatal fricative'], ['ɺ','Voiced alveolar lateral flap'], ['ɧ','Simultaneous ʃ and x'],
] as const;
export const affricates = [['t͡s','Voiceless alveolar'],['tʃ','Voiceless postalveolar'],['t͡ɕ','Voiceless alveolo-palatal'],['ʈ͡ʂ','Voiceless retroflex'],['d͡z','Voiced alveolar'],['dʒ','Voiced postalveolar'],['d͡ʑ','Voiced alveolo-palatal'],['ɖ͡ʐ','Voiced retroflex']] as const;
export const nonPulmonic = [
 ['Bilabial', ['ʘ'], ['ɓ'], ['pʼ']], ['Dental / alveolar', ['ǀ','ǃ'], ['ɗ'], ['tʼ']], ['Palatal / palatoalveolar', ['ǂ'], ['ʄ'], []], ['Velar', [], ['ɠ'], ['kʼ']], ['Uvular', [], ['ʛ'], []], ['Alveolar lateral', ['ǁ'], [], []], ['Alveolar fricative', [], [], ['sʼ']],
] as const;
export const diacritics = [
 ['n̥ d̥ ŋ̊','Voiceless'],['s̬ t̬','Voiced'],['tʰ dʰ','Aspirated'],['ɔ̹','More rounded'],['ɔ̜','Less rounded'],['u̟','Advanced'],['e̠','Retracted'],['ë','Centralized'],['e̽','Mid-centralized'],['n̩','Syllabic'],['e̯','Non-syllabic'],['ə˞ a˞','Rhoticity'],['b̤ a̤','Breathy voiced'],['b̰ a̰','Creaky voiced'],['t̼ d̼','Linguolabial'],['tʷ dʷ','Labialized'],['tʲ dʲ','Palatalized'],['tˠ dˠ','Velarized'],['tˤ dˤ','Pharyngealized'],['l̴','Velarized or pharyngealized'],['e̝','Raised'],['e̞','Lowered'],['e̘','Advanced tongue root'],['e̙','Retracted tongue root'],['t̪ d̪','Dental'],['t̺ d̺','Apical'],['t̻ d̻','Laminal'],['ẽ','Nasalized'],['dⁿ','Nasal release'],['dˡ','Lateral release'],['d̚','No audible release'],
] as const;
export const suprasegmentals = [['ˈ','Primary stress'],['ˌ','Secondary stress'],['ː','Long'],['ˑ','Half-long'],['ĕ','Extra-short'],['|','Minor (foot) group'],['‖','Major (intonation) group'],['.','Syllable break'],['‿','Linking (absence of a break)']] as const;
export const tones = [['e̋ ˥','Extra high'],['é ˦','High'],['ē ˧','Mid'],['è ˨','Low'],['ȅ ˩','Extra low'],['↓','Downstep'],['↑','Upstep'],['ě ˩˥','Rising'],['ê ˥˩','Falling'],['e᷄ ˧˥','High rising'],['e᷅ ˩˧','Low rising'],['e᷈ ˦˥˦','Rising–falling'],['↗','Global rise'],['↘','Global fall']] as const;
// Include British vowels and English allophones absent from the American inventory.
export const englishVariants: readonly string[] = ['ɒ', 'ɜ', 'ɾ', 'ʔ', 'ʍ'];
