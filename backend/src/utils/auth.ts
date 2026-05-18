import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '89d7cebf7ad9afa8986f5fb6b48d59b5233a58f52d006310c66986c9b0ee5417';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

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
