import { useEffect, useState } from 'react';
import api from '../api/axios';
import { QueueNumber } from '../types';
import { motion } from 'framer-motion';
import { ClipboardList, User, Plus, Play, X, Printer, CheckCircle } from 'lucide-react';

export default function Queue() {
  const [queue, setQueue] = useState<QueueNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ 
    classification: 'GERAL',
    targetType: '',
    targetName: '',
    roomId: '',
    examTypeId: '',
    animalName: '',
    animalId: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<any | null>(null);
  const [lastCalledId, setLastCalledId] = useState<string | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [userSubmitting, setUserSubmitting] = useState(false);
  const [allAnimals, setAllAnimals] = useState<any[]>([]);
  const [showAnimalForm, setShowAnimalForm] = useState(false);
  const [showInlineTutor, setShowInlineTutor] = useState(false);
  const [animalFormData, setAnimalFormData] = useState({
    name: '',
    species: '',
    breed: '',
    birth_date: '',
    weight: '',
    tutorId: '',
    allergies: '',
  });
  const [tutors, setTutors] = useState<any[]>([]);
  const [animalSubmitting, setAnimalSubmitting] = useState(false);

  // Destinos para Senha
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);

  const playNotification = (species?: string) => {
    let soundUrl = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'; // Generic chime
    
    if (species) {
      const lowerSpecies = species.toLowerCase();
      if (lowerSpecies.includes('cão') || lowerSpecies.includes('cao') || lowerSpecies.includes('cachorro') || lowerSpecies.includes('dog')) {
        soundUrl = 'https://www.myinstants.com/media/sounds/dog-barking-sound-effect_1.mp3'; // Dog bark
      } else if (lowerSpecies.includes('gato') || lowerSpecies.includes('cat')) {
        soundUrl = 'https://www.myinstants.com/media/sounds/meow_4.mp3'; // Cat meow
      }
    }
    
    const audio = new Audio(soundUrl);
    audio.play().catch(e => console.log('Audio play failed:', e));
  };

  useEffect(() => {
    fetchQueue();
    fetchDestinations();
    fetchAnimals();
    fetchTutors();
    const interval = setInterval(fetchQueue, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchAnimals = async () => {
    try {
      const response = await api.get('/animals');
      setAllAnimals(response.data.animals || []);
    } catch (error) {
      console.error('Error fetching animals:', error);
    }
  };

  const fetchTutors = async () => {
    try {
      const response = await api.get('/tutors');
      setTutors(response.data.tutors || []);
    } catch (error) {
      console.error('Error fetching tutors:', error);
    }
  };

  const fetchDestinations = async () => {
    try {
      const [specRes, roomRes, examRes, docRes] = await Promise.all([
        api.get('/appointments/specialties'),
        api.get('/clinic/rooms'),
        api.get('/exams/types'),
        api.get('/clinic/doctors')
      ]);
      setSpecialties(specRes.data.specialties || []);
      setRooms(roomRes.data.rooms || []);
      setExams(examRes.data.examTypes || []);
      setDoctors(docRes.data.doctors || []);
    } catch (error) {
      console.error('Erro ao buscar destinos:', error);
    }
  };

  useEffect(() => {
    const called = queue.find(t => t.status === 'CHAMADA');
    if (called && called.id !== lastCalledId) {
      setLastCalledId(called.id);
      playNotification((called as any).animal?.species);
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
    if (!formData.animalId) {
      alert('Por favor, selecione um pet cadastrado ou cadastre um novo pet.');
      setSubmitting(false);
      return;
    }
    try {
      const payload = {
        classification: formData.classification,
        targetType: formData.targetType || null,
        targetName: formData.targetName || null,
        roomId: formData.roomId || null,
        examTypeId: formData.examTypeId || null,
        animalName: formData.animalName || null,
        animalId: formData.animalId || null
      };
      const response = await api.post('/queue', payload);
      setLastGenerated({ ...response.data.ticket, _localAnimalName: formData.animalName });
      setShowForm(false);
      setFormData({ 
        classification: 'GERAL',
        targetType: '',
        targetName: '',
        roomId: '',
        examTypeId: '',
        animalName: '',
        animalId: ''
      });
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
      alert('Paciente criado com sucesso! Agora você pode cadastrar o animal.');
      fetchTutors();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao criar paciente');
    } finally {
      setUserSubmitting(false);
    }
  };

  const handleCreateAnimal = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnimalSubmitting(true);
    try {
      let finalTutorId = animalFormData.tutorId;

      // Se estiver no modo "Novo Tutor" (inline), cadastra o tutor primeiro
      if (showInlineTutor) {
        setUserSubmitting(true);
        await api.post('/auth/register-staff', { 
          ...userForm, 
          role: 'PACIENTE',
          password: userForm.password || '123456' // Senha padrão
        });
        
        const tutorsRes = await api.get('/tutors');
        const newTutor = tutorsRes.data.tutors.find((t: any) => t.user.email === userForm.email);
        
        if (!newTutor) throw new Error('Falha ao localizar o novo tutor cadastrado.');
        finalTutorId = newTutor.id;
        
        setShowInlineTutor(false);
        setUserForm({ name: '', email: '', password: '', phone: '' });
        fetchTutors();
      }

      const res = await api.post('/animals', { ...animalFormData, tutorId: finalTutorId });
      setShowAnimalForm(false);
      setAnimalFormData({ name: '', species: '', breed: '', birth_date: '', weight: '', tutorId: '', allergies: '' });
      alert('Cadastro realizado com sucesso!');
      fetchAnimals();
      
      // Auto-seleciona o novo animal no formulário de senha
      if (res.data.animal) {
        setFormData(prev => ({ ...prev, animalId: res.data.animal.id, animalName: res.data.animal.name }));
      }
    } catch (error: any) {
      console.error('Erro no cadastro:', error);
      alert(error.response?.data?.error || error.message || 'Erro ao realizar cadastro');
    } finally {
      setAnimalSubmitting(false);
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

  const targetLabels: any = {
    ESPECIALIDADE: 'Especialidade',
    SALA: 'Consultório',
    EXAME: 'Exame',
    TRIAGEM: 'Triagem',
    MEDICO: 'Médico'
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
            className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">Gerar Senha</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={generateTicket} className="space-y-5">
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

              <hr className="border-gray-100" />
              
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">Identificação do Pet</label>
                  <button 
                    type="button"
                    onClick={() => setShowAnimalForm(true)}
                    className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1 bg-primary-50 px-2 py-1 rounded-lg"
                  >
                    <Plus className="w-3 h-3" />
                    Novo Pet
                  </button>
                </div>
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="Busque pelo nome do pet..."
                    className="input-field"
                    value={formData.animalName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({ ...formData, animalName: val, animalId: '' });
                    }}
                    required
                  />
                  {formData.animalName && !formData.animalId && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-[60] max-h-48 overflow-y-auto">
                      {allAnimals
                        .filter(a => a.name.toLowerCase().includes(formData.animalName.toLowerCase()))
                        .map(a => (
                          <button
                            key={a.id}
                            type="button"
                            className="w-full text-left px-4 py-3 hover:bg-primary-50 border-b border-gray-50 last:border-0 transition-colors flex flex-col"
                            onClick={() => {
                              setFormData({ ...formData, animalName: a.name, animalId: a.id });
                            }}
                          >
                            <span className="font-bold text-gray-800 text-sm">{a.name}</span>
                            <span className="text-[10px] text-gray-400 uppercase tracking-widest">
                              {a.species} • {a.breed} • Tutor: {a.tutor?.user?.name || 'N/A'}
                            </span>
                          </button>
                        ))
                      }
                      {allAnimals.filter(a => a.name.toLowerCase().includes(formData.animalName.toLowerCase())).length === 0 && (
                        <div className="px-4 py-3 text-sm text-gray-500 italic">
                          Nenhum pet encontrado. Clique em "Novo Pet" para cadastrar.
                        </div>
                      )}
                    </div>
                  )}
                  {formData.animalId && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                        Selecionado
                      </span>
                      <button 
                        type="button"
                        onClick={() => setFormData({ ...formData, animalName: '', animalId: '' })}
                        className="p-1 hover:bg-gray-100 rounded-full"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <hr className="border-gray-100" />

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Destino do Atendimento (Opcional)</label>
                  <select
                    className="input-field py-2.5"
                    value={formData.targetType}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({ 
                        ...formData, 
                        targetType: val, 
                        targetName: val === 'TRIAGEM' ? 'Triagem' : '', 
                        roomId: '', 
                        examTypeId: '' 
                      });
                    }}
                  >
                    <option value="">Nenhum destino específico</option>
                    <option value="TRIAGEM">Triagem</option>
                    <option value="ESPECIALIDADE">Especialidade Médica</option>
                    <option value="MEDICO">Médico Específico</option>
                    <option value="SALA">Consultório</option>
                    <option value="EXAME">Exame</option>
                  </select>
                </div>

                {formData.targetType === 'ESPECIALIDADE' && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
                    <label className="block text-xs font-bold text-gray-400 uppercase">Selecione a Especialidade</label>
                    <select
                      className="input-field"
                      value={formData.targetName}
                      onChange={(e) => setFormData({ ...formData, targetName: e.target.value })}
                      required
                    >
                      <option value="">Selecione...</option>
                      {specialties.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </motion.div>
                )}

                {formData.targetType === 'MEDICO' && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
                    <label className="block text-xs font-bold text-gray-400 uppercase">Selecione o Médico</label>
                    <select
                      className="input-field"
                      value={formData.targetName}
                      onChange={(e) => {
                        const doc = doctors.find(d => d.user.name === e.target.value);
                        const firstRoom = doc?.doctor_rooms?.[0]?.room;
                        setFormData({ 
                          ...formData, 
                          targetName: e.target.value, 
                          roomId: firstRoom?.id || '' 
                        });
                      }}
                      required
                    >
                      <option value="">Selecione...</option>
                      {doctors.map(d => (
                        <option key={d.id} value={d.user.name}>{d.user.name} ({d.specialty})</option>
                      ))}
                    </select>
                    {formData.roomId && (
                      <p className="text-xs text-primary-600 font-bold mt-1 animate-pulse">
                        📍 Vinculado ao: {rooms.find(r => r.id === formData.roomId)?.name || 'Consultório'}
                      </p>
                    )}
                  </motion.div>
                )}

                {formData.targetType === 'SALA' && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
                    <label className="block text-xs font-bold text-gray-400 uppercase">Selecione o Consultório</label>
                    <select
                      className="input-field"
                      value={formData.roomId}
                      onChange={(e) => {
                        const room = rooms.find(r => r.id === e.target.value);
                        setFormData({ ...formData, roomId: e.target.value, targetName: room ? room.name : '' });
                      }}
                      required
                    >
                      <option value="">Selecione...</option>
                      {rooms.map(r => (
                        <option key={r.id} value={r.id}>{r.name} ({r.sector})</option>
                      ))}
                    </select>
                  </motion.div>
                )}

                {formData.targetType === 'EXAME' && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
                    <label className="block text-xs font-bold text-gray-400 uppercase">Selecione o Exame</label>
                    <select
                      className="input-field"
                      value={formData.examTypeId}
                      onChange={(e) => {
                        const exam = exams.find(ex => ex.id === e.target.value);
                        setFormData({ ...formData, examTypeId: e.target.value, targetName: exam ? exam.name : '' });
                      }}
                      required
                    >
                      <option value="">Selecione...</option>
                      {exams.map(ex => (
                        <option key={ex.id} value={ex.id}>{ex.name}</option>
                      ))}
                    </select>
                  </motion.div>
                )}
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

      {showAnimalForm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">Novo Pet</h2>
              <button onClick={() => setShowAnimalForm(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleCreateAnimal} className="space-y-4">
              <div className="bg-primary-50/30 p-4 rounded-2xl border border-primary-100">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Tutor Responsável</label>
                  <button 
                    type="button" 
                    onClick={() => setShowInlineTutor(!showInlineTutor)}
                    className="text-[10px] font-black text-primary-700 bg-white px-2 py-1 rounded-md shadow-sm border border-primary-100 hover:bg-primary-50 transition-colors"
                  >
                    {showInlineTutor ? 'Selecionar Existente' : '+ Novo Tutor'}
                  </button>
                </div>

                {!showInlineTutor ? (
                  <>
                    <select
                      value={animalFormData.tutorId}
                      onChange={(e) => setAnimalFormData({ ...animalFormData, tutorId: e.target.value })}
                      className="input-field bg-white"
                      required
                    >
                      <option value="">Selecione o Tutor...</option>
                      {tutors.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.user.name} ({t.user.email})
                        </option>
                      ))}
                    </select>
                    {tutors.length === 0 && (
                      <p className="text-[10px] text-red-400 mt-2 italic">
                        ⚠️ Nenhum tutor cadastrado no sistema.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                    <input 
                      type="text" 
                      placeholder="Nome do Tutor" 
                      className="input-field bg-white"
                      value={userForm.name}
                      onChange={e => setUserForm({...userForm, name: e.target.value})}
                      required
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        type="email" 
                        placeholder="Email" 
                        className="input-field bg-white"
                        value={userForm.email}
                        onChange={e => setUserForm({...userForm, email: e.target.value})}
                        required
                      />
                      <input 
                        type="text" 
                        placeholder="Telefone" 
                        className="input-field bg-white"
                        value={userForm.phone}
                        onChange={e => setUserForm({...userForm, phone: e.target.value})}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 italic">
                      * O tutor será cadastrado automaticamente com a senha padrão '123456'.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Informações do Pet</h3>
                
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome do Pet *</label>
                  <input
                    type="text"
                    value={animalFormData.name}
                    onChange={(e) => setAnimalFormData({ ...animalFormData, name: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Espécie *</label>
                    <select
                      value={animalFormData.species}
                      onChange={(e) => setAnimalFormData({ ...animalFormData, species: e.target.value })}
                      className="input-field"
                      required
                    >
                      <option value="">Selecione</option>
                      <option value="Cachorro">Cachorro</option>
                      <option value="Gato">Gato</option>
                      <option value="Pássaro">Pássaro</option>
                      <option value="Roedor">Roedor</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Raça *</label>
                    <input
                      type="text"
                      value={animalFormData.breed}
                      onChange={(e) => setAnimalFormData({ ...animalFormData, breed: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nascimento *</label>
                    <input
                      type="date"
                      value={animalFormData.birth_date}
                      onChange={(e) => setAnimalFormData({ ...animalFormData, birth_date: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Peso (kg) *</label>
                    <input
                      type="number"
                      step="0.1"
                      value={animalFormData.weight}
                      onChange={(e) => setAnimalFormData({ ...animalFormData, weight: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Observações / Alergias</label>
                  <textarea
                    value={animalFormData.allergies}
                    onChange={(e) => setAnimalFormData({ ...animalFormData, allergies: e.target.value })}
                    className="input-field"
                    rows={2}
                    placeholder="Alergias, condições especiais..."
                  />
                </div>
              </div>

              <button type="submit" disabled={animalSubmitting || userSubmitting} className="btn-primary w-full py-4 text-base shadow-lg mt-4 flex items-center justify-center gap-2">
                {(animalSubmitting || userSubmitting) ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Salvar e Gerar Senha
                  </>
                )}
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
                <p className="text-[10px] font-bold text-gray-600 uppercase print:text-xs leading-tight">
                  {lastGenerated.targetType ? `${targetLabels[lastGenerated.targetType] || lastGenerated.targetType}: ${lastGenerated.targetName}` : 'Atendimento Geral'}
                </p>
                <p className="text-[10px] font-bold text-primary-600 uppercase print:text-sm">
                  PET: {lastGenerated.animal?.name || lastGenerated._localAnimalName || lastGenerated.animalName || 'Não identificado'}
                </p>
                {lastGenerated.animal?.tutor?.user?.name && (
                  <p className="text-[8px] font-medium text-gray-500 uppercase print:text-[10px]">
                    Tutor: {lastGenerated.animal.tutor.user.name}
                  </p>
                )}
                
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
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 2s infinite ease-in-out;
        }
      `}} />

      {calledTicket && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-gradient-to-br from-green-500 via-green-600 to-emerald-700 rounded-[2.5rem] p-10 text-white text-center shadow-2xl shadow-green-200/50 relative overflow-hidden"
        >
          {/* Elementos decorativos de fundo */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/5 rounded-full -ml-10 -mb-10 blur-2xl" />

          <div className="relative z-10">
            <span className="inline-block px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-[0.3em] mb-6 border border-white/20">
              Atendimento em Destaque
            </span>
            
            <div className="mb-8">
              <h2 className="text-sm font-bold opacity-70 uppercase tracking-widest mb-1">Senha Atual</h2>
              <p className="text-7xl md:text-8xl font-black tracking-tighter leading-none drop-shadow-lg">
                {calledTicket.code.split(' - ')[0]}
              </p>
              <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 bg-white/10 rounded-lg">
                <span className={`w-2 h-2 rounded-full ${priorityColors[calledTicket.classification]}`} />
                <span className="text-xs font-bold uppercase tracking-wider opacity-90">{calledTicket.classification}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {/* Card do Pet */}
              <div className="bg-white/15 backdrop-blur-xl rounded-[2rem] p-6 border border-white/20 flex flex-col items-center justify-center transition-transform hover:scale-[1.02]">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
                  <span className="text-2xl">🐾</span>
                </div>
                <h3 className="text-xs font-bold opacity-60 uppercase tracking-widest mb-1">Paciente</h3>
                <p className="text-2xl font-black truncate max-w-full px-2">
                  {calledTicket.animal?.name || (calledTicket as any)._localAnimalName || calledTicket.animalName || 'Não identificado'}
                </p>
                {calledTicket.animal?.tutor?.user?.name && (
                  <p className="text-sm font-medium opacity-70 mt-1 flex items-center gap-1.5">
                    <User className="w-3 h-3" />
                    {calledTicket.animal.tutor.user.name}
                  </p>
                )}
              </div>

              {/* Card do Local */}
              <div className="bg-white rounded-[2rem] p-6 flex flex-col items-center justify-center shadow-xl transition-transform hover:scale-[1.02]">
                <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mb-3 text-green-600 shadow-inner">
                  <span className="text-2xl">
                    {(calledTicket as any).targetType === 'TRIAGEM' ? '📋' : 
                     (calledTicket as any).targetType === 'ESPECIALIDADE' || (calledTicket as any).targetType === 'MEDICO' ? '🩺' : '🚪'}
                  </span>
                </div>
                <h3 className="text-xs font-bold text-green-800/40 uppercase tracking-widest mb-1">Local de Atendimento</h3>
                <p className="text-2xl font-black text-green-900 truncate max-w-full px-2 leading-tight">
                  {rooms.find(r => r.id === (calledTicket as any).roomId)?.name || (calledTicket as any).targetName || 'Aguarde Instruções'}
                </p>
                {rooms.find(r => r.id === (calledTicket as any).roomId)?.name && (calledTicket as any).targetName && (calledTicket as any).targetType === 'MEDICO' ? (
                  <p className="text-[10px] font-bold text-green-600/80 uppercase mt-0.5">
                    Dr(a). {(calledTicket as any).targetName}
                  </p>
                ) : (
                  <p className="text-sm font-bold text-green-600/60 uppercase tracking-wider mt-1">
                    {(calledTicket as any).room?.sector || targetLabels[(calledTicket as any).targetType] || 'Verifique o Painel'}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-10">
              <button
                onClick={() => updateStatus(calledTicket.id, 'ATENDIDA')}
                className="bg-white text-green-700 px-10 py-4 rounded-2xl font-black text-lg hover:bg-green-50 shadow-2xl shadow-green-900/20 transition-all active:scale-95 flex items-center gap-3 mx-auto"
              >
                <CheckCircle className="w-6 h-6" />
                Finalizar Atendimento
              </button>
            </div>
          </div>
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
            <p className="text-2xl font-bold text-gray-800 mb-1">{ticket.code}</p>
            
            {ticket.animal ? (
              <div className="mb-1">
                <p className="text-sm font-bold text-gray-700">{ticket.animal.name}</p>
                {ticket.animal.tutor?.user?.name && (
                  <p className="text-[10px] text-gray-400 font-medium uppercase">Tutor: {ticket.animal.tutor.user.name}</p>
                )}
              </div>
            ) : ticket.animalName ? (
              <p className="text-sm font-bold text-gray-700 mb-1">{ticket.animalName}</p>
            ) : (
              <p className="text-xs text-gray-400 italic mb-1">Sem identificação do pet</p>
            )}

            {(ticket as any).targetName || (ticket as any).room ? (
              <div className="inline-flex flex-col gap-0.5 mt-2">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-700 bg-primary-50 px-2.5 py-1 rounded-lg">
                  {(ticket as any).targetType === 'ESPECIALIDADE' || (ticket as any).targetType === 'MEDICO' ? '🩺' : 
                   (ticket as any).targetType === 'SALA' || (ticket as any).room ? '🚪' : 
                   (ticket as any).targetType === 'TRIAGEM' ? '📋' : '🧪'} 
                  {(ticket as any).room?.name || (ticket as any).targetName}
                </div>
                {((ticket as any).room?.sector || (ticket as any).targetType) && (
                  <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider ml-1">
                    {(ticket as any).room?.sector || targetLabels[(ticket as any).targetType]}
                  </span>
                )}
              </div>
            ) : null}
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