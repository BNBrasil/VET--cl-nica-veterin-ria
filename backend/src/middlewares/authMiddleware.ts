import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth';

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.cookies?.token;
  
  if (!token) {
    res.status(401).json({ error: 'Acesso negado. Faça login para continuar.' });
    return;
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Sessão expirada ou inválida. Faça login novamente.' });
  }
};

/**
 * Role-based access control middleware.
 * @param allowedRoles Array of allowed roles.
 */
export const roleMiddleware = (allowedRoles: ('PACIENTE' | 'RECEPCIONISTA' | 'MEDICO' | 'ADMIN')[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Acesso proibido. Você não tem a permissão necessária.' });
      return;
    }

    next();
  };
};
