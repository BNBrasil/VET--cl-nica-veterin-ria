import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { PawPrint, Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowLeft, CheckCircle2, XCircle, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type ViewState = 'LOGIN' | '2FA' | 'FORGOT_PASSWORD' | 'RESET_PASSWORD';

export default function Login() {
  const [view, setView] = useState<ViewState>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoadingLocal, setIsLoadingLocal] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { login, verify2FA, forgotPassword, resetPassword, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  // Password Strength Logic
  const [strength, setStrength] = useState({
    length: false,
    upper: false,
    number: false,
    special: false
  });

  useEffect(() => {
    setStrength({
      length: password.length >= 6,
      upper: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password)
    });
  }, [password]);

  const passwordsMatch = password === confirmPassword && password !== '';
  const allMet = Object.values(strength).every(Boolean);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsLoadingLocal(true);
    try {
      const result = await login(email, password);
      if (result?.requires2FA) {
        setUserId(result.userId || null);
        setView('2FA');
      } else {
        navigate('/');
      }
    } catch (err) {
      // Handled in store
    } finally {
      setIsLoadingLocal(false);
    }
  };

  const handle2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setIsLoadingLocal(true);
    try {
      await verify2FA(userId, code);
      navigate('/');
    } catch (err) {
    } finally {
      setIsLoadingLocal(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingLocal(true);
    try {
      const res = await forgotPassword(email);
      setSuccessMessage(res.message);
    } catch (err) {
    } finally {
      setIsLoadingLocal(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordsMatch || !allMet) return;
    setIsLoadingLocal(true);
    try {
      await resetPassword(token, password);
      setSuccessMessage('Senha alterada com sucesso! Faça login.');
      setView('LOGIN');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
    } finally {
      setIsLoadingLocal(false);
    }
  };

  const Requirement = ({ met, text }: { met: boolean; text: string }) => (
    <div className={`flex items-center gap-2 text-xs transition-colors ${met ? 'text-green-500' : 'text-gray-400'}`}>
      {met ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
      <span>{text}</span>
    </div>
  );

  const slideVariants = {
    enter: { x: 20, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -20, opacity: 0 }
  };

  return (
    <div className="min-h-screen flex">
      {/* Lado Esquerdo - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 to-primary-800 p-12 flex-col justify-center items-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 text-center text-white"
        >
          <div className="w-24 h-24 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-8 backdrop-blur-sm">
            <PawPrint className="w-12 h-12" />
          </div>
          <h1 className="text-4xl font-bold mb-4">VET</h1>
          <p className="text-xl text-white/80">Cuidado e Segurança</p>
          <p className="mt-4 text-white/60">Sistema de Gestão com Autenticação de Camada Dupla</p>
        </motion.div>
      </div>

      {/* Lado Direito - Forms */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 overflow-hidden">
            <AnimatePresence mode="wait">
              {/* VIEW: LOGIN */}
              {view === 'LOGIN' && (
                <motion.div
                  key="login"
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                >
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Bem-vindo</h2>
                  <p className="text-gray-500 mb-8">Entre com sua conta para continuar</p>

                  {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                      <XCircle className="w-4 h-4" /> {error}
                    </div>
                  )}

                  {successMessage && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> {successMessage}
                    </div>
                  )}

                  <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="input-field pl-11"
                          placeholder="seu@email.com"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">Senha</label>
                        <button 
                          type="button" 
                          onClick={() => setView('FORGOT_PASSWORD')}
                          className="text-xs text-primary-600 hover:underline"
                        >
                          Esqueceu a senha?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="input-field pl-11 pr-11"
                          placeholder="••••••••"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoadingLocal}
                      className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2"
                    >
                      {isLoadingLocal ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Entrar'}
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        setIsLoadingLocal(true);
                        try {
                          // Login automático com as credenciais do admin principal
                          await login('nicolasbds.2000@gmail.com', 'admin123');
                          navigate('/admin');
                        } catch (err) {
                          console.error('Falha no login automático:', err);
                        } finally {
                          setIsLoadingLocal(false);
                        }
                      }}
                      className="w-full py-2 text-xs text-gray-400 hover:text-primary-600 border border-dashed border-gray-200 rounded-lg transition-all flex items-center justify-center gap-2 mt-4"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" /> Entrar direto como Admin (Nicolas)
                    </button>
                  </form>

                  <p className="mt-6 text-center text-gray-600">
                    Não tem uma conta?{' '}
                    <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
                      Cadastrar
                    </Link>
                  </p>
                </motion.div>
              )}

              {/* VIEW: 2FA */}
              {view === '2FA' && (
                <motion.div
                  key="2fa"
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  <button 
                    onClick={() => setView('LOGIN')}
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6 text-sm"
                  >
                    <ArrowLeft className="w-4 h-4" /> Voltar
                  </button>
                  <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mb-6">
                    <ShieldCheck className="w-8 h-8 text-primary-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Verificação em Duas Etapas</h2>
                  <p className="text-gray-500 mb-8 text-sm">
                    Enviamos um código de 6 dígitos para o seu e-mail. Por favor, insira-o abaixo.
                  </p>

                  <form onSubmit={handle2FA} className="space-y-6">
                    <div>
                      <input
                        type="text"
                        maxLength={6}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                        className="w-full text-center text-3xl tracking-[1em] font-bold py-4 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 outline-none transition-all"
                        placeholder="000000"
                        required
                        autoFocus
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isLoadingLocal || code.length < 6}
                      className="btn-primary w-full py-3"
                    >
                      {isLoadingLocal ? 'Verificando...' : 'Confirmar Código'}
                    </button>
                  </form>
                </motion.div>
              )}

              {/* VIEW: FORGOT PASSWORD */}
              {view === 'FORGOT_PASSWORD' && (
                <motion.div
                  key="forgot"
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  <button 
                    onClick={() => setView('LOGIN')}
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6 text-sm"
                  >
                    <ArrowLeft className="w-4 h-4" /> Voltar
                  </button>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Recuperar Senha</h2>
                  <p className="text-gray-500 mb-8">Digite seu e-mail para receber um link de recuperação.</p>

                  <form onSubmit={handleForgot} className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="input-field"
                        placeholder="seu@email.com"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isLoadingLocal}
                      className="btn-primary w-full py-3"
                    >
                      {isLoadingLocal ? 'Enviando...' : 'Enviar Link'}
                    </button>
                  </form>
                  
                  <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                    <button 
                      onClick={() => setView('RESET_PASSWORD')}
                      className="text-sm text-primary-600 hover:underline"
                    >
                      Já tem um token? Clique aqui para redefinir.
                    </button>
                  </div>
                </motion.div>
              )}

              {/* VIEW: RESET PASSWORD */}
              {view === 'RESET_PASSWORD' && (
                <motion.div
                  key="reset"
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  <button 
                    onClick={() => setView('LOGIN')}
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6 text-sm"
                  >
                    <ArrowLeft className="w-4 h-4" /> Cancelar
                  </button>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Nova Senha</h2>
                  <p className="text-gray-500 mb-6 text-sm">Insira o token recebido e sua nova senha.</p>

                  <form onSubmit={handleReset} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Token de Recuperação</label>
                      <input
                        type="text"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        className="input-field py-2.5"
                        placeholder="Cole o token aqui"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Nova Senha</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="input-field pl-11 pr-11 py-2.5"
                          placeholder="••••••••"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    {/* Password Requirements UI */}
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
                      <Requirement met={strength.length} text="Mínimo de 6 caracteres" />
                      <Requirement met={strength.upper} text="Uma letra maiúscula (A-Z)" />
                      <Requirement met={strength.number} text="Um número (0-9)" />
                      <Requirement met={strength.special} text="Um caractere especial (@!#$%)" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar Nova Senha</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={`input-field pl-11 py-2.5 transition-all ${
                            confirmPassword !== '' && !passwordsMatch ? 'border-red-300 bg-red-50' : ''
                          }`}
                          placeholder="••••••••"
                          required
                        />
                      </div>
                      <AnimatePresence>
                        {confirmPassword !== '' && !passwordsMatch && (
                          <motion.p 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="text-[11px] text-red-500 mt-1.5 flex items-center gap-1"
                          >
                            <X className="w-3 h-3" /> As senhas não coincidem
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoadingLocal || !allMet || !passwordsMatch}
                      className="btn-primary w-full py-3 mt-4 disabled:opacity-50"
                    >
                      {isLoadingLocal ? 'Redefinindo...' : 'Atualizar Senha'}
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}