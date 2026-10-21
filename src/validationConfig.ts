import { z } from 'zod';

// Configure before schema modules load so strict CSP never triggers an eval probe.
z.config({ jitless: true });
