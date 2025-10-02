// Tell TS that req.user exists (populated by our session middleware)
import type { SessionPayload } from '../utils/sessionCookie';

declare module 'express-serve-static-core' {
  interface Request {
    user?: SessionPayload | null;
  }
}
