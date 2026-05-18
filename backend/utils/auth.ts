import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.VET_JWT_SECRET || 'vet-crm-secret-key-2026-v1';
const JWT_EXPIRES_IN = process.env.VET_JWT_EXPIRES_IN || '7d';

export interface AuthUserPayload {
  id: string;
  name: string;
  email: string;
  role: 'PACIENTE' | 'RECEPCIONISTA' | 'MEDICO' | 'ADMIN';
}

/**
 * Hashes a plain text password using bcryptjs.
 * @param password Pure password
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

/**
 * Compares a plain text password with a stored hash.
 */
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

/**
 * Generates a signed JWT token for user sessions.
 */
export const generateToken = (payload: AuthUserPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });
};

/**
 * Verifies a JWT token and returns the decoded payload.
 */
export const verifyToken = (token: string): AuthUserPayload => {
  return jwt.verify(token, JWT_SECRET) as AuthUserPayload;
};
