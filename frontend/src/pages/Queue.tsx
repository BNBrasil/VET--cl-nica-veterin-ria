import { useEffect, useState } from 'react';
import api from '../api/axios';
import { QueueNumber } from '../types';
import { motion } from 'framer-motion';
import { ClipboardList, User, Plus, Play, X, Printer, CheckCircle } from 'lucide-react';

export default function Queue() {
  const [queue, setQueue] = useState<QueueNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ classification: 'GERAL' });
  const [submitting, setSubmitting] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<QueueNumber | null>(null);
  const [lastCalledId, setLastCalledId] = useState<string | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [userSubmitting, setUserSubmitting] = useState(false);

  const playNotification = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.play().catch(e => console.log('Audio play failed:', e));
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const called = queue.find(t => t.status === 'CHAMADA');
    if (called && called.id !== lastCalledId) {
      setLastCalledId(called.id);
      playNotification();
    }
  }, [queue, lastCalledId]);

  const fetchQueue = async () => {
    try {
      const response = await api.get('/queue');
      setQueue(response.data.queue || []);
    } catch (error) {
      console.error('Error fetching queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await api.post('/queue', formData);
      setLastGenerated(response.data.ticket);
      setShowForm(false);
      setFormData({ classification: 'GERAL' });
      fetchQueue();
    } catch (error) {
      console.error('Error generating ticket:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const callNext = async () => {
    try {
      await api.post('/queue/call-next');
      fetchQueue();
    } catch (error) {
      console.error('Error calling next:', error);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/queue/${id}`, { status });
      fetchQueue();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserSubmitting(true);
    try {
      await api.post('/auth/register-staff', { ...userForm, role: 'PACIENTE' });
      setShowUserForm(false);
      setUserForm({ name: '', email: '', password: '', phone: '' });
      alert('Paciente criado com sucesso! Agora você pode gerar a senha ou cadastrar o animal.');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao criar paciente');
    } finally {
      setUserSubmitting(false);
    }
  };

  const priorityColors: any = {
    URGENTE: 'bg-red-500',
    PREFERENCIAL: 'bg-yellow-500',
    GERAL: 'bg-blue-500',
  };

  const statusColors: any = {
    AGUARDANDO: 'bg-gray-100 text-gray-700',
    CHAMADA: 'bg-green-100 text-green-700',
    ATENDIDA: 'bg-blue-100 text-blue-700',
    CANCELADA: 'bg-red-100 text-red-700',
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  const calledTicket = queue.find(t => t.status === 'CHAMADA');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Fila de Atendimento</h1>
          <p className="text-gray-500 mt-1">Gerencie a fila de senhas</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowUserForm(true)} className="btn-secondary border-primary-200 text-primary-700 flex items-center gap-2">
            <User className="w-5 h-5" />
            Novo Cliente
          </button>
          <button onClick={callNext} className="btn-primary flex items-center gap-2">
            <Play className="w-5 h-5" />
            Chamar Próxima
          </button>
          <button onClick={() => setShowForm(true)} className="btn-secondary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Nova Senha
          </button>
        </div>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">Gerar Senha</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={generateTicket} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Classificação do Atendimento</label>
                <div className="space-y-2">
                  {['GERAL', 'PREFERENCIAL', 'URGENTE'].map((type) => (
                    <label key={type} className={`flex items-center gap-3 p-4 border-2 rounded-2xl cursor-pointer transition-all ${
                      formData.classification === type ? 'border-primary-600 bg-primary-50/50' : 'border-gray-100 hover:border-gray-200'
                    }`}>
                      <input
                        type="radio"
                        name="classification"
                        value={type}
                        checked={formData.classification === type}
                        onChange={(e) => setFormData({ ...formData, classification: e.target.value })}
                        className="w-5 h-5 text-primary-600 focus:ring-primary-500 border-gray-300"
                      />
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-800 text-sm">{type}</span>
                        <span className="text-[10px] text-gray-400 uppercase tracking-widest">
                          {type === 'URGENTE' ? 'Risco Imediato' : type === 'PREFERENCIAL' ? 'Prioridade por Lei' : 'Atendimento Comum'}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <button type="submit" disabled={submitting} className="btn-primary w-full py-4 text-base shadow-lg shadow-primary-200 mt-4">
                {submitting ? 'Gerando...' : 'Gerar Senha'}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}

      {showUserForm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">Novo Cliente/Paciente</h2>
              <button onClick={() => setShowUserForm(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleCreatePatient} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nome do Tutor</label>
                <input 
                  type="text" 
                  value={userForm.name} 
                  onChange={e => setUserForm({...userForm, name: e.target.value})} 
                  placeholder="Nome completo" 
                  className="input-field" 
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Email</label>
                <input 
                  type="email" 
                  value={userForm.email} 
                  onChange={e => setUserForm({...userForm, email: e.target.value})} 
                  placeholder="email@exemplo.com" 
                  className="input-field" 
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Senha Inicial</label>
                <input 
                  type="password" 
                  value={userForm.password} 
                  onChange={e => setUserForm({...userForm, password: e.target.value})} 
                  placeholder="Mínimo 6 caracteres" 
                  className="input-field" 
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Telefone</label>
                <input 
                  type="text" 
                  value={userForm.phone} 
                  onChange={e => setUserForm({...userForm, phone: e.target.value})} 
                  placeholder="(00) 00000-0000" 
                  className="input-field" 
                />
              </div>

              <button type="submit" disabled={userSubmitting} className="btn-primary w-full py-4 text-base shadow-lg mt-4">
                {userSubmitting ? 'Cadastrando...' : 'Cadastrar Cliente'}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}

      {lastGenerated && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center"
          >
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center text-green-600 mx-auto mb-4">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-1">Senha Gerada!</h2>
            <p className="text-sm text-gray-500 mb-6">Sua senha foi emitida com sucesso</p>
            
            <div id="ticket-to-print" className="p-4 border-2 border-dashed border-gray-200 rounded-2xl mb-6 bg-white print:border-none print:p-0 print:w-[80mm] mx-auto">
              <div className="text-center space-y-1">
                <h1 className="text-sm font-black text-gray-900 uppercase tracking-tighter print:text-lg">VET- CLÍNICA VETERINÁRIA</h1>
                <p className="text-[10px] font-bold text-gray-600 uppercase print:text-xs">Atendimento Geral</p>
                
                <div className="py-4 my-2 border-y border-gray-100 border-dashed print:border-black">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 print:text-black">SENHA</p>
                  <p className="text-5xl font-black text-primary-600 print:text-6xl print:text-black">
                    {lastGenerated.code.split(' - ')[0]}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest print:text-black">CLASSIFICAÇÃO</p>
                  <p className={`text-xs font-black px-3 py-1 rounded-full inline-block ${
                    lastGenerated.classification === 'URGENTE' ? 'bg-red-100 text-red-700' :
                    lastGenerated.classification === 'PREFERENCIAL' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  } print:text-black print:bg-transparent print:p-0 print:text-sm`}>
                    {lastGenerated.classification}
                  </p>
                </div>

                <p className="text-[9px] text-gray-400 mt-6 font-mono print:text-black print:text-[10px]">
                  {new Date(lastGenerated.generation_datetime).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 print:hidden">
              <button 
                onClick={handlePrint}
                className="btn-primary flex items-center justify-center gap-2 py-3"
              >
                <Printer className="w-5 h-5" />
                Imprimir Senha
              </button>
              <button 
                onClick={() => setLastGenerated(null)}
                className="text-gray-500 font-medium hover:text-gray-700 py-2"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Estilos para Impressão */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { margin: 0; size: 80mm auto; }
          body * {
            visibility: hidden;
          }
          #ticket-to-print, #ticket-to-print * {
            visibility: visible;
            color: black !important;
          }
          #ticket-to-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            padding: 10mm;
            border: none !important;
          }
        }
      `}} />

      {calledTicket && (
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-8 text-white text-center"
        >
          <h2 className="text-sm font-medium opacity-80 mb-2">ATUALMENTE CHAMANDO</h2>
          <p className="text-6xl font-bold mb-4">{calledTicket.code}</p>
          <button
            onClick={() => updateStatus(calledTicket.id, 'ATENDIDA')}
            className="bg-white text-green-600 px-6 py-2 rounded-lg font-medium hover:bg-green-50"
          >
            Finalizar
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {queue.filter(t => t.status !== 'CHAMADA').map((ticket) => (
          <motion.div
            key={ticket.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 ${ticket.status === 'ATENDIDA' ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className={`px-2 py-1 rounded text-xs font-medium text-white ${priorityColors[ticket.classification]}`}>
                {ticket.classification}
              </span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[ticket.status]}`}>
                {ticket.status}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-800 mb-2">{ticket.code}</p>
            {ticket.animal && (
              <p className="text-sm text-gray-500">{ticket.animal.name} - {ticket.animal.tutor?.user?.name}</p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => updateStatus(ticket.id, 'CHAMADA')}
                className="flex-1 py-2 bg-primary-100 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-200"
              >
                Chamar
              </button>
              <button
                onClick={() => updateStatus(ticket.id, 'CANCELADA')}
                className="py-2 px-4 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {queue.length === 0 && (
        <div className="text-center py-12">
          <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Nenhuma senha na fila</p>
        </div>
      )}
    </div>
  );
}