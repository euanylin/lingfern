export const pageRoute = (path: string) => /^\/(introduction|start|today|progress|library(?:\/(?:dictionary|saved|ipa|grammar|history))?|settings(?:\/about)?|learn\/[^/]+)$/.test(path);

export const canonicalPagePath = (path: string) => path.endsWith('/') && pageRoute(path.slice(0, -1)) ? path.slice(0, -1) : undefined;
