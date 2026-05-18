import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { PawPrint, Mail, Lock, User, Phone, MapPin, Eye, EyeOff, Check, X, Search, Hash, Plus, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    cep: '',
    address: '',
    number: '',
    complement: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingCEP, setIsSearchingCEP] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuthStore();
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
      length: formData.password.length >= 6,
      upper: /[A-Z]/.test(formData.password),
      number: /[0-9]/.test(formData.password),
      special: /[^A-Za-z0-9]/.test(formData.password)
    });
  }, [formData.password]);

  const passwordsMatch = formData.password === formData.confirmPassword && formData.password !== '';
  const allMet = Object.values(strength).every(Boolean);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Máscara para CEP
    if (name === 'cep') {
      const masked = value.replace(/\D/g, '').slice(0, 8);
      setFormData({ ...formData, [name]: masked });
      
      if (masked.length === 8) {
        handleCEPSearch(masked);
      }
      return;
    }

    setFormData({ ...formData, [name]: value });
  };

  const handleCEPSearch = async (cep: string) => {
    setIsSearchingCEP(true);
    try {
      const response = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
      if (response.data.erro) {
        setError('CEP não encontrado');
      } else {
        const { logradouro, bairro, localidade, uf } = response.data;
        setFormData(prev => ({
          ...prev,
          address: `${logradouro}, ${bairro}, ${localidade} - ${uf}`
        }));
        setError('');
      }
    } catch (err) {
      setError('Erro ao buscar CEP');
    } finally {
      setIsSearchingCEP(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!passwordsMatch) {
      setError('As senhas não coincidem');
      return;
    }

    if (!allMet) {
      setError('A senha não atende a todos os requisitos');
      return;
    }

    setIsLoading(true);
    try {
      await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        cep: formData.cep,
        address: formData.address,
        number: formData.number,
        complement: formData.complement,
      });
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao realizar cadastro');
    } finally {
      setIsLoading(false);
    }
  };

  const Requirement = ({ met, text }: { met: boolean; text: string }) => (
    <div className={`flex items-center gap-2 text-xs transition-colors ${met ? 'text-green-500' : 'text-gray-400'}`}>
      {met ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
      <span>{text}</span>
    </div>
  );

  return (
    <div className="min-h-screen flex">
      {/* Lado Esquerdo - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 to-primary-800 p-12 flex-col justify-center items-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-64 h-64 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 text-center text-white"
        >
          <div className="w-24 h-24 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-8 backdrop-blur-sm">
            <PawPrint className="w-12 h-12" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Junte-se a nós</h1>
          <p className="text-xl text-white/80">Cadastre-se para gerenciar seus pets</p>
          <p className="mt-4 text-white/60">Segurança de dados e cuidado veterinário em um só lugar</p>
        </motion.div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md my-8"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Criar Conta</h2>
            <p className="text-gray-500 mb-6 text-sm">Preencha seus dados para se cadastrar</p>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                <XCircle className="w-4 h-4" /> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome Completo</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="input-field pl-11 py-2.5"
                      placeholder="João Silva"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="input-field pl-11 py-2.5"
                      placeholder="seu@email.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="input-field pl-11 py-2.5"
                      placeholder="(00) 00000-0000"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">CEP</label>
                  <div className="relative">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${isSearchingCEP ? 'text-primary-500 animate-pulse' : 'text-gray-400'}`} />
                    <input
                      type="text"
                      name="cep"
                      value={formData.cep}
                      onChange={handleChange}
                      className="input-field pl-11 py-2.5"
                      placeholder="00000-000"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Endereço</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      className="input-field pl-11 py-2.5"
                      placeholder="Rua, Bairro, Cidade"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Número</label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        name="number"
                        value={formData.number}
                        onChange={handleChange}
                        className="input-field pl-11 py-2.5"
                        placeholder="123"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Complemento</label>
                    <div className="relative">
                      <Plus className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        name="complement"
                        value={formData.complement}
                        onChange={handleChange}
                        className="input-field pl-11 py-2.5"
                        placeholder="Apto, Casa"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="input-field pl-11 pr-11 py-2.5"
                      placeholder="••••••"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className={`input-field pl-11 py-2.5 transition-all ${
                        formData.confirmPassword !== '' && !passwordsMatch ? 'border-red-300 bg-red-50' : ''
                      }`}
                      placeholder="••••••"
                      required
                    />
                  </div>
                  <AnimatePresence>
                    {formData.confirmPassword !== '' && !passwordsMatch && (
                      <motion.p 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-[11px] text-red-500 mt-1.5 flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> As senhas não coincidem
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !allMet || !passwordsMatch}
                className="btn-primary w-full py-3 text-base mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Cadastrando...' : 'Cadastrar'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-600">
              Já tem uma conta?{' '}
              <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                Entrar
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}