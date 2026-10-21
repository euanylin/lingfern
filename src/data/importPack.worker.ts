import { inspectResourcePack } from './resourcePack';
import { inspectCommunityPack } from './communityPack';

self.onmessage = async (event: MessageEvent<Uint8Array>) => {
  try {
    // Fall back only during inspection; never retry installation as another format.
    let resource;
    try { resource = await inspectResourcePack(event.data); } catch { /* Validate alternative formats independently. */ }
    if (resource) self.postMessage({ kind: 'resource', pack: resource }, { transfer: Object.values(resource.files).map(file => file.buffer) });
    else {
      const pack = await inspectCommunityPack(event.data);
      self.postMessage({ kind: 'community', pack }, { transfer: Object.values(pack.media).map(file => file.buffer) });
    }
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'PACKAGE_INVALID' });
  }
};
