import { AuthUserPayload } from '../../utils/auth';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}
