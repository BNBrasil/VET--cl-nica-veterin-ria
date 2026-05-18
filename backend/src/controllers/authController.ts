import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { comparePassword, generateToken, hashPassword } from '../utils/auth';
import { logAction } from '../utils/audit';
import { z } from 'zod';
import crypto from 'crypto';
import { sendMail } from '../utils/mail';

// Durations and Constants
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;

// Validators
const registerSchema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'A senha deve conter pelo menos 6 caracteres'),
  phone: z.string().min(8, 'Telefone muito curto'),
  cep: z.string().min(8, 'CEP inválido'),
  address: z.string().min(5, 'Endereço incompleto'),
  number: z.string().min(1, 'Número obrigatório'),
  complement: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Formato de email inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

export const registerTutor = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = registerSchema.parse(req.body);
    const email = data.email.toLowerCase();

    // Check if email is taken
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: 'Este email já está cadastrado.' });
      return;
    }

    const password_hash = await hashPassword(data.password);

    // Start transaction to create user and associated tutor profile
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: data.name,
          email,
          password_hash,
          role: 'PACIENTE',
        },
      });

      await tx.tutor.create({
        data: {
          userId: createdUser.id,
          phone: data.phone,
          cep: data.cep,
          address: data.address,
          number: data.number,
          complement: data.complement,
        },
      });

      return createdUser;
    });

    // Auto login with cookie setup
    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as 'PACIENTE' | 'RECEPCIONISTA' | 'MEDICO' | 'ADMIN',
    };

    const token = generateToken(payload);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    await logAction(user.id, 'CADASTRO_PACIENTE', 'users', user.id);

    res.status(201).json({
      message: 'Cadastro realizado com sucesso.',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues[0].message });
      return;
    }
    console.error('[REGISTER ERROR]:', error);
    res.status(500).json({ error: 'Falha no cadastro interno.' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const lowerEmail = email.toLowerCase();

    const user = await prisma.user.findUnique({ where: { email: lowerEmail } });
    if (!user) {
      res.status(401).json({ error: 'Credenciais incorretas.' });
      return;
    }

    // Check brute force lockout
    if (user.locked_until && user.locked_until > new Date()) {
      const timeRemaining = Math.ceil((user.locked_until.getTime() - Date.now()) / 60000);
      res.status(423).json({
        error: `Conta temporariamente bloqueada. Tente novamente em ${timeRemaining} minutos.`,
      });
      return;
    }

    const isValid = await comparePassword(password, user.password_hash);

    if (!isValid) {
      const newAttempts = user.failed_attempts + 1;
      let updates: any = { failed_attempts: newAttempts };

      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        updates.locked_until = lockedUntil;
        updates.failed_attempts = 0; // resets upon lockout trigger
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updates,
      });

      res.status(401).json({
        error: 'Credenciais incorretas.',
        remainingAttempts: MAX_FAILED_ATTEMPTS - newAttempts,
      });
      return;
    }

    // Reset failed attempts on successful login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failed_attempts: 0,
        locked_until: null,
      },
    });

    // Check if 2FA is enabled
    if (user.two_factor_enabled) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 min

      await prisma.twoFactorCode.create({
        data: {
          userId: user.id,
          code,
          expires_at,
        },
      });

      await sendMail(
        user.email,
        'Código de Verificação - VET',
        `<p>Seu código de acesso é: <strong>${code}</strong></p><p>Válido por 10 minutos.</p>`
      );

      res.json({
        requires2FA: true,
        userId: user.id,
        message: 'Código de verificação enviado para seu e-mail.',
      });
      return;
    }

    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as 'PACIENTE' | 'RECEPCIONISTA' | 'MEDICO' | 'ADMIN',
    };

    const token = generateToken(payload);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    await logAction(user.id, 'LOGIN_SUCESSO', 'users', user.id);

    res.json({
      message: 'Login efetuado com sucesso.',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues[0].message });
      return;
    }
    console.error('[LOGIN ERROR]:', error);
    res.status(500).json({ error: 'Falha interna no servidor ao logar.' });
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Não autorizado.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tutor: true,
        doctor: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao recuperar dados da sessão.' });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logout concluído.' });
};

/**
 * Extra feature for Admins to register employees (Doctors, Recepcionists, etc.)
 */
export const adminCreateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userSchema = z.object({
      name: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(6),
      role: z.enum(['RECEPCIONISTA', 'MEDICO', 'ADMIN', 'PACIENTE']),
      // Optional fields for Doctor
      specialty: z.string().optional(),
      crm: z.string().optional(),
      // Optional fields for Tutor (Paciente)
      phone: z.string().optional(),
      address: z.string().optional(),
    });

    const body = userSchema.parse(req.body);
    const email = body.email.toLowerCase();

    // Check permissions: RECEPCIONISTA can ONLY create PACIENTE
    if (req.user!.role === 'RECEPCIONISTA' && body.role !== 'PACIENTE') {
      res.status(403).json({ error: 'Recepcionistas só podem cadastrar Pacientes.' });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: 'Email já cadastrado.' });
      return;
    }

    const password_hash = await hashPassword(body.password);

    const newUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          name: body.name,
          email,
          password_hash,
          role: body.role,
        },
      });

      if (body.role === 'MEDICO') {
        if (!body.crm) throw new Error('CRM é obrigatório para médicos.');
        await tx.doctor.create({
          data: {
            userId: u.id,
            specialty: body.specialty || 'Geral',
            crm: body.crm,
          },
        });
      } else if (body.role === 'PACIENTE') {
        await tx.tutor.create({
          data: {
            userId: u.id,
            phone: body.phone || 'N/A',
            address: body.address || 'N/A',
          },
        });
      }

      return u;
    });

    await logAction(req.user!.id, `ADMIN_CRIOU_USUARIO_${body.role}`, 'users', newUser.id);

    res.status(201).json({
      message: `Usuário (${body.role}) criado com sucesso.`,
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues[0].message });
      return;
    }
    res.status(500).json({ error: error.message || 'Falha ao criar usuário.' });
  }
};

export const listUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar usuários.' });
  }
};
export const verify2FA = async (req: Request, res: Response): Promise<void> => {
  try {
    const schema = z.object({
      userId: z.string().uuid(),
      code: z.string().length(6),
    });

    const { userId, code } = schema.parse(req.body);

    const validCode = await prisma.twoFactorCode.findFirst({
      where: {
        userId,
        code,
        expires_at: { gt: new Date() },
      },
    });

    if (!validCode) {
      res.status(401).json({ error: 'Código inválido ou expirado.' });
      return;
    }

    // Limpa código usado
    await prisma.twoFactorCode.delete({ where: { id: validCode.id } });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as any,
    };

    const token = generateToken(payload);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: 'Autenticação concluída.',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro na validação de 2FA.' });
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Por segurança, não informamos se o e-mail existe
      res.json({ message: 'Se o e-mail existir, um link de recuperação será enviado.' });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires_at = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token,
        expires_at,
      },
    });

    await sendMail(
      user.email,
      'Recuperação de Senha - VET',
      `<p>Você solicitou a recuperação de senha. Use o token abaixo:</p><h3>${token}</h3><p>Válido por 15 minutos.</p>`
    );

    res.json({ message: 'E-mail de recuperação enviado.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao processar recuperação de senha.' });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const schema = z.object({
      token: z.string(),
      newPassword: z.string().min(6),
    });

    const { token, newPassword } = schema.parse(req.body);

    const resetRequest = await prisma.passwordReset.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetRequest || resetRequest.expires_at < new Date()) {
      res.status(400).json({ error: 'Token inválido ou expirado.' });
      return;
    }

    const password_hash = await hashPassword(newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRequest.userId },
        data: { password_hash, failed_attempts: 0, locked_until: null },
      }),
      prisma.passwordReset.delete({ where: { id: resetRequest.id } }),
    ]);

    res.json({ message: 'Senha alterada com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao resetar senha.' });
  }
};
