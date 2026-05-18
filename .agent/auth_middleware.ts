import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '89d7cebf7ad9afa8986f5fb6b48d59b5233a58f52d006310c66986c9b0ee5417';

export interface AuthPayload {
  id: number;
  username: string;
  role: 'admin' | 'user';
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.cookies?.token;
  if (!token) {
    res.status(401).json({ error: 'Não autenticado. Faça login via sistema Hostinger.' });
    return;
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET) as AuthPayload;
    next();
  } catch {
    res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
  }
};
