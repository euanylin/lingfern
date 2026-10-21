import { z } from 'zod';

// Configure schemas before import to prevent CSP-blocked eval probes.
z.config({ jitless: true });
