import { scopes as bccampusScopes } from '../../content/corpus/bccampus-beginner-source-review.json';
import { scopes } from '../../content/corpus/open-reading-beginner-source-review.json';

/** Admit only archived editions; current repository licences cannot expand this list. */
export const openReadingLicenceUrl = 'https://creativecommons.org/licenses/by/4.0/' as const;
export const openReadingLicenceSha256 = '0ff174546cbe3dd1287da231f9796618ac2f6e6595b2d11f567b2c9790f64868';
export const openReadingEditions = [
  { id: 'openstax-psychology-2e', rootId: 'openstax-book-psychology-2e', repository: 'osbooks-psychology', commit: 'e061043bf2f9e86ace51c4e8dc9555160f60a99d', sourceHash: '6be60580c7d640091e5406bf3c28ca9c5aa84b8de717cd5110ce11ba104c5435' },
  { id: 'openstax-biology-2e', rootId: 'openstax-book-biology-2e', repository: 'osbooks-biology-bundle', commit: 'd2779c2edfb435e75047325434fe2fe93d5aa120', sourceHash: 'ad36c39c255b4b369765e8d7db8f0f41cc23074555e07649e13cf295ca79253e' },
  { id: 'openstax-introduction-sociology-3e', rootId: 'openstax-book-introduction-sociology-3e', repository: 'osbooks-introduction-sociology', commit: 'd35d5f3bdac40f93607d600134865d4f13ce1f9b', sourceHash: '93918f53e902eeab76e526924bf6807e3b3f04e1127f4bdb03b7b2b2d87d2a0b' },
  { id: 'openstax-us-history', rootId: 'openstax-book-us-history', repository: 'osbooks-us-history', commit: '046331cfcea0ac1b1a8fd461b3e6aae638845af3', sourceHash: '522791e9ee96f31b4146759bdf6c54377222d1356816108431270d94f02b0dbb' },
  { id: 'bccampus-physical-geology-2e', rootId: 'bccampus-book-physical-geology-2e', repository: '', commit: '', bookUrl: 'https://opentextbc.ca/physicalgeology2ed/', sourceHash: 'bac292c654f85b96e17831f8db7b5ce9181e0d062f0f3a133aefc298a7fd4f71' },
  { id: 'bccampus-abealfreader1', rootId: 'bccampus-book-abealfreader1', repository: '', commit: '', bookUrl: 'https://opentextbc.ca/abealfreader1/', sourceHash: '825a59e388141e6d508122346d19f25f4f8a454bf31c96428c50b865e7e8baab' },
  { id: 'openstax-introduction-business', rootId: 'openstax-book-introduction-business', repository: 'osbooks-introduction-business', commit: '9d3b8c44e4567d207424bc92d4f7ceffb1a9dcd5', sourceHash: 'db6b2facf57ecf362c66d13e19a1d6dd03e7cd020687fdc73d9c69862dc9d033' },
  { id: 'openstax-organizational-behavior', rootId: 'openstax-book-organizational-behavior', repository: 'osbooks-principles-of-management-bundle', commit: '54660e7c5d6b4495a796032457a70a94708f3eeb', sourceHash: 'b8483e2ce6031dae70beafcab4193e8a67b950c9b1697d4cc0cf157a3acdf7b7' },
  { id: 'openstax-principles-management', rootId: 'openstax-book-principles-management', repository: 'osbooks-principles-of-management-bundle', commit: '54660e7c5d6b4495a796032457a70a94708f3eeb', sourceHash: 'efa6b362e2a9e29c4173ccf7e940b5648bf203f7bc6ca26f6eaa6c595f732afb' },
  { id: 'openstax-principles-marketing', rootId: 'openstax-book-principles-marketing', repository: 'osbooks-principles-marketing', commit: 'deb6e19777dc40f3c8861fad1a3fa319d91a940a', sourceHash: '0abfdd153d8f8434c4bfec55594e5cdc0ed6e8e388f5aae79e499b3d2e0d24e7' },
  { id: 'openstax-introduction-anthropology', rootId: 'openstax-book-introduction-anthropology', repository: 'osbooks-introduction-anthropology', commit: '6cb07defded1d0d8d246aa2f592a044e2e19136e', sourceHash: '3faac5a77d333f57d6d23c4fbc885db6e37fa5dcec8640ecc5e5de850b3d2e5a' },
  { id: 'openstax-introduction-philosophy', rootId: 'openstax-book-introduction-philosophy', repository: 'osbooks-introduction-philosophy', commit: 'ec2804507cf93609bcdd72cc2f2f5aea054a8ae5', sourceHash: '2271f2fdc8e2cf9473870ee30db97b6e36c412a4844af6ab875c87cf39aeae63' },
  { id: 'openstax-world-history-volume-1', rootId: 'openstax-book-world-history-volume-1', repository: 'osbooks-world-history', commit: 'dbe4cb6de157b506f07fab8c52ffe80704578f69', sourceHash: '02866b629aa340e44e86d0d9e333c285c7626e06b7c1dce227f9cc22c99bb8ad' },
  { id: 'openstax-world-history-volume-2', rootId: 'openstax-book-world-history-volume-2', repository: 'osbooks-world-history', commit: 'dbe4cb6de157b506f07fab8c52ffe80704578f69', sourceHash: 'a0324290e568ffa3e95935a0e29ee6881ee8745aaef315d10857955d6eaa52ee' },
  { id: 'openstax-introduction-political-science', rootId: 'openstax-book-introduction-political-science', repository: 'osbooks-introduction-political-science', commit: '91f18d9248993ae0bcd44e08562acb61f24a08e8', sourceHash: '202054d5e7230bd8d95aab6b66b178b4c059345923acd11608a27f6d06c76ea8' },
  { id: 'openstax-college-success', rootId: 'openstax-book-college-success', repository: 'osbooks-college-success-bundle', commit: '964da1b4e0343a4607b8af1b49470a35faf55f96', sourceHash: '4c7124b939373d006b7897e1fbbc5b96318d7cfd5b6b76eded6bb6ec2ec62d28' },
  { id: 'openstax-entrepreneurship', rootId: 'openstax-book-entrepreneurship', repository: 'osbooks-entrepreneurship', commit: '9c67d18c5faaa4cdb4cd087ce684c742e14f4005', sourceHash: '399d315f08e6dc7d311591e4b4357e1fafe92fb859d3184e91f3e9e1ec571aee' },
  { id: 'bccampus-abealfreader2', rootId: 'bccampus-book-abealfreader2', repository: '', commit: '', bookUrl: 'https://opentextbc.ca/abealfreader2/', sourceHash: 'c0a7dd7f9aef317da7ddf56d62142579e99a8bd3df5a3247c8e49aff78252fb1' },
  { id: 'bccampus-abealfreader3', rootId: 'bccampus-book-abealfreader3', repository: '', commit: '', bookUrl: 'https://opentextbc.ca/abealfreader3/', sourceHash: 'ece5616c9b2ab3f6b6bb7c26db8496edc73614ded4b6f383084dd4b26f182bd3' },
  { id: 'bccampus-abealfreader4', rootId: 'bccampus-book-abealfreader4', repository: '', commit: '', bookUrl: 'https://opentextbc.ca/abealfreader4/', sourceHash: '5b37986ce396493aa00e61ecff2883dffd5558cb2a587154b252e63d3e8ab3ca' },
  { id: 'bccampus-introduction-tourism-hospitality', rootId: 'bccampus-book-introduction-tourism-hospitality', repository: '', commit: '', bookUrl: 'https://opentextbc.ca/introtourism/', sourceHash: 'a90219d114cedad1c3fa6190e54e83154252276a5843ba5aa8e4a0b7653ff744' },
  { id: 'openstax-american-government-3e', rootId: 'openstax-book-american-government-3e', repository: 'osbooks-american-government', commit: 'dd9a37728e80d377f2be83c2a0085d3c6ef6854c', sourceHash: 'e368a9cdecb601e48b55a5966eb74ec657e892d9c8c4ef34bc10ce932f587e3e' },
  { id: 'openstax-anatomy-and-physiology-2e', rootId: 'openstax-book-anatomy-and-physiology-2e', repository: 'osbooks-anatomy-physiology', commit: '3f855aef2941c1da9c01db904d45b129e26106f2', sourceHash: '5a564a7e28abffaabc2563be429b044fe71406782a8486ca360a450108ec81bf' },
  { id: 'openstax-astronomy-2e', rootId: 'openstax-book-astronomy-2e', repository: 'osbooks-astronomy', commit: '9d7e69a2e0c9a651ad42254b9a93b701a6b08c10', sourceHash: '42d62def6d8d415025b07dad2d59a861ba665358f725607b0b565a92e6b0e976' },
  { id: 'openstax-business-ethics', rootId: 'openstax-book-business-ethics', repository: 'osbooks-business-ethics', commit: '21122d7c873e27ef0f2f1bf0c395bd175b32d7be', sourceHash: 'a999b0c4e28f88af6307584f01861dc53c07a272d6d9c6875ff144f9d93a6d20' },
  { id: 'openstax-principles-economics-3e', rootId: 'openstax-book-principles-economics-3e', repository: 'osbooks-principles-economics-bundle', commit: 'd0e5fcf6df9363727b71970378671fb7a804fce3', sourceHash: '0d3cad09e5a511c3a404e0bc56a6b2710e29757f5c959ab84bbdabef26235325' },
  { id: 'openstax-microbiology', rootId: 'openstax-book-microbiology', repository: 'osbooks-microbiology', commit: '3f4edff55fe6935eed59579a1dc2f7479b6ffc7d', sourceHash: '6d086899ad71e3fd516d161acdfc1b9d1689b73bd25f37ce7b63adbbc3a31b03' },
  { id: 'openstax-chemistry-2e', rootId: 'openstax-book-chemistry-2e', repository: 'osbooks-chemistry-bundle', commit: '9928441ef0badc3ff024c6a1fe2842c0048ea858', sourceHash: 'a1014005920277478a0e8a0ebbdd3bb9ec3ec9884fd61570a69c9866661d7651' },
  { id: 'openstax-introduction-intellectual-property', rootId: 'openstax-book-introduction-intellectual-property', repository: 'osbooks-introduction-intellectual-property', commit: '55411cd2253d9d71104c7fe44c14ded7006585a8', sourceHash: '67ec994b99140a1602e9e2d74446409e4f75e4cdece216b047fd27a89163c587' },
  { id: 'openstax-college-physics-2e', rootId: 'openstax-book-college-physics-2e', repository: 'osbooks-college-physics-bundle', commit: '84147e8ddbb1a7d2689e235630b230e6b4f20480', sourceHash: '3d3cf2c93dddb3d55c61a1dcd09d6bae31e6ca7033b5e50081c818e28b4134b6' },
  { id: 'openstax-introductory-statistics-2e', rootId: 'openstax-book-introductory-statistics-2e', repository: 'osbooks-introductory-statistics-bundle', commit: 'fc004a462a69bb1b64ac327c6dd1847899476e06', sourceHash: '8b9dde8c3c4ad1cd3c35f59a7e5c664e3834284f975300fa8e653b72f82ade35' },
  { id: 'openstax-introductory-business-statistics-2e', rootId: 'openstax-book-introductory-business-statistics-2e', repository: 'osbooks-introductory-statistics-bundle', commit: 'fc004a462a69bb1b64ac327c6dd1847899476e06', sourceHash: 'fc36801ff752b04986601d130becb50997edf0b5f5d0f5aa4511e0efbe411631' },
  { id: 'openstax-intermediate-algebra-2e', rootId: 'openstax-book-intermediate-algebra-2e', repository: 'osbooks-prealgebra-bundle', commit: 'bba5f5244066884797f730149d918e33f2beefd1', sourceHash: 'e82e3d36f8146695e3d78d0288bb7c4107420ee027b0f6856fee091810d53963' },
  { id: 'openstax-principles-finance', rootId: 'openstax-book-principles-finance', repository: 'osbooks-principles-finance', commit: 'e1283a2ffc060e7eef593151de3642ed79e12466', sourceHash: 'fafccd0fd0fe6876604d72542b13fac288883dd60c24da2a8d87c91d38fdd695' },
  { id: 'openstax-writing-guide', rootId: 'openstax-book-writing-guide', repository: 'osbooks-writing-guide', commit: 'aa32f33d8a271aaca990eaaf9c28e050b0a25a67', sourceHash: 'cf91dccde6d02bf840add41ae7d1ba1da916c6d746af491ac220133e40a42092' },
  { id: 'bccampus-abealfreader5', rootId: 'bccampus-book-abealfreader5', repository: '', commit: '', bookUrl: 'https://opentextbc.ca/abealfreader5/', sourceHash: 'a8a9bd569e540df6f4f650f4c459ec3ad9ddf7b06e7a1418bd40ad8572af737d' },
] as const;
export function openReadingEdition(id: string) { return openReadingEditions.find(edition => edition.id === id); }
export function openReadingBookUrl(edition: typeof openReadingEditions[number]) {
  return 'bookUrl' in edition ? edition.bookUrl : `https://github.com/openstax/${edition.repository}/blob/${edition.commit}/collections/${edition.id.slice(9)}.collection.xml`;
}
export function openReadingDownloadUrl(edition: typeof openReadingEditions[number]) {
  return edition.repository ? `https://api.github.com/repos/openstax/${edition.repository}/tarball/${edition.commit}` : openReadingBookUrl(edition);
}
export function validOpenReadingChapter(id: string, url: string, locator: string) {
  const edition = openReadingEdition(id);
  if (!edition) return false;
  if (edition.repository) return /^modules\/m\d+\/index\.cnxml$/.test(locator)
    && url === `https://github.com/openstax/${edition.repository}/blob/${edition.commit}/${locator}`;
  if (['bccampus-abealfreader2', 'bccampus-abealfreader3', 'bccampus-abealfreader4', 'bccampus-abealfreader5', 'bccampus-introduction-tourism-hospitality'].includes(id))
    return /^chapter\/[a-z0-9-]+$/.test(locator) && url === `${openReadingBookUrl(edition)}${locator}/`;
  return /^[a-z0-9-]+$/.test(locator) && url === `${openReadingBookUrl(edition)}chapter/${locator}/`;
}

/** Review source ranges without storing questions; preserve each original book root. */
export const openReadingBeginnerScopes = [...scopes, ...bccampusScopes];
export function validOpenReadingBeginnerScope(passage: { id: string; wordCount: number; startingPoints?: readonly string[]; sourceProvenance?: object }) {
  const provenance = passage.sourceProvenance as Record<string, unknown> | undefined;
  return !!provenance && openReadingBeginnerScopes.some(scope => passage.id === scope.id && passage.wordCount === scope.wordCount
    && JSON.stringify(passage.startingPoints) === JSON.stringify(scope.startingPoints)
    && scope.startingPoints.every(point => passage.wordCount <= (point === 'A1' ? 120 : 160))
    && Object.entries(scope.sourceProvenance).every(([key, value]) => provenance[key] === value));
}
