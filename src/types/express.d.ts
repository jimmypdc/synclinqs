import { JwtPayload } from '../api/middleware/auth.js';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export {};
