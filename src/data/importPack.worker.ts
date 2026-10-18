import { inspectResourcePack } from './resourcePack';
import { inspectCommunityPack } from './communityPack';

self.onmessage = async (event: MessageEvent<Uint8Array>) => {
  try {
    // Inspection fallback only: installation failures must never try another format.
    let resource;
    try { resource = await inspectResourcePack(event.data); } catch { /* Other formats retain their own strict validation. */ }
    if (resource) self.postMessage({ kind: 'resource', pack: resource }, { transfer: Object.values(resource.files).map(file => file.buffer) });
    else {
      const pack = await inspectCommunityPack(event.data);
      self.postMessage({ kind: 'community', pack }, { transfer: Object.values(pack.media).map(file => file.buffer) });
    }
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'PACKAGE_INVALID' });
  }
};
