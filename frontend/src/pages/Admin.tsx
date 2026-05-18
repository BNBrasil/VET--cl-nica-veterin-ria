import { useEffect, useState } from 'react';
import api from '../api/axios';
import { Doctor, Room } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Loader, X, Stethoscope, DoorOpen, Users, Shield, 
  User as UserIcon, CheckCircle, AlertCircle, Settings, Clock, 
  Save, Calendar, Syringe, TestTube, Trash2
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: 'PACIENTE' | 'RECEPCIONISTA' | 'MEDICO' | 'ADMIN';
  created_at: string;
}

interface CatalogItem {
  id: string;
  name: string;
  description?: string;
}

export default function Admin() {
  const { user: currentUser } = useAuthStore();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [examTypes, setExamTypes] = useState<CatalogItem[]>([]);
  const [vaccineTypes, setVaccineTypes] = useState<CatalogItem[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'doctors' | 'rooms' | 'users' | 'config' | 'exams' | 'vaccines'>('doctors');
  const [showForm, setShowForm] = useState<'user' | 'doctor' | 'room' | 'exam' | 'vaccine' | null>(null);
  
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'PACIENTE' as any, specialty: '', crm: '', phone: '', address: '' });
  const [roomForm, setRoomForm] = useState({ name: '', sector: 'CONSULTORIO' });
  const [catalogForm, setCatalogForm] = useState({ name: '', description: '', default_dosage: '', stock: 0 });
  
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Config States
  const [clinicConfig, setClinicConfig] = useState({ consultation_interval: 30 });
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null); // doctorId
  const [scheduleDraft, setScheduleDraft] = useState<any>({});

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'doctors') {
        const res = await api.get('/clinic/doctors');
        setDoctors(res.data.doctors || []);
      } else if (activeTab === 'rooms') {
        const res = await api.get('/clinic/rooms');
        setRooms(res.data.rooms || []);
      } else if (activeTab === 'users') {
        const res = await api.get('/users');
        setUsers(res.data.users || []);
      } else if (activeTab === 'config') {
        const res = await api.get('/clinic/config');
        setClinicConfig(res.data.config || { consultation_interval: 30 });
      } else if (activeTab === 'exams') {
        const res = await api.get('/catalog/exams');
        setExamTypes(res.data.exams || []);
      } else if (activeTab === 'vaccines') {
        const res = await api.get('/catalog/vaccines');
        setVaccineTypes(res.data.vaccines || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await api.patch(`/users/${userId}/role`, { role: newRole });
      setSuccessMessage('Cargo atualizado com sucesso!');
      fetchData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error updating role:', error);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/auth/register-staff', userForm);
      setShowForm(null);
      setUserForm({ name: '', email: '', password: '', role: 'PACIENTE', specialty: '', crm: '', phone: '', address: '' });
      fetchData();
      setSuccessMessage('Usuário criado com sucesso!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Error creating user:', error);
      alert(error.response?.data?.error || 'Erro ao criar usuário');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/clinic/rooms', roomForm);
      setShowForm(null);
      setRoomForm({ name: '', sector: 'CONSULTORIO' });
      fetchData();
    } catch (error) {
      console.error('Error creating room:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCatalogItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const endpoint = activeTab === 'exams' ? '/catalog/exams' : '/catalog/vaccines';
      await api.post(endpoint, catalogForm);
      setShowForm(null);
      setCatalogForm({ name: '', description: '', default_dosage: '', stock: 0 });
      fetchData();
      setSuccessMessage('Item adicionado ao catálogo!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error creating catalog item:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStock = async (id: string, quantity: number) => {
    try {
      await api.patch(`/catalog/vaccines/${id}/stock`, { quantity });
      setSuccessMessage('Estoque atualizado!');
      fetchData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error updating stock:', error);
    }
  };

  const handleDeleteCatalogItem = async (id: string) => {
    if (!confirm('Deseja realmente remover este item?')) return;
    try {
      const endpoint = activeTab === 'exams' ? `/catalog/exams/${id}` : `/catalog/vaccines/${id}`;
      await api.delete(endpoint);
      fetchData();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const handleSaveConfig = async () => {
    setSubmitting(true);
    try {
      await api.patch('/clinic/config', clinicConfig);
      setSuccessMessage('Configurações salvas!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error saving config:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const startEditSchedule = (doctor: Doctor) => {
    setEditingSchedule(doctor.id);
    try {
      setScheduleDraft(doctor.schedule_config ? JSON.parse(doctor.schedule_config) : {
        mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: []
      });
    } catch {
      setScheduleDraft({ mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] });
    }
  };

  const saveSchedule = async (doctorId: string) => {
    setSubmitting(true);
    try {
      await api.patch(`/clinic/doctors/${doctorId}/schedule`, {
        schedule_config: JSON.stringify(scheduleDraft)
      });
      setEditingSchedule(null);
      setSuccessMessage('Agenda do médico atualizada!');
      fetchData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error saving schedule:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const addTimeRange = (day: string) => {
    const current = scheduleDraft[day] || [];
    setScheduleDraft({
      ...scheduleDraft,
      [day]: [...current, '08:00-12:00']
    });
  };

  const removeTimeRange = (day: string, index: number) => {
    const current = [...scheduleDraft[day]];
    current.splice(index, 1);
    setScheduleDraft({
      ...scheduleDraft,
      [day]: current
    });
  };

  const updateTimeRange = (day: string, index: number, value: string) => {
    const current = [...scheduleDraft[day]];
    current[index] = value;
    setScheduleDraft({
      ...scheduleDraft,
      [day]: current
    });
  };

  const daysLabels: any = {
    mon: 'Segunda', tue: 'Terça', wed: 'Quarta', thu: 'Quinta', fri: 'Sexta', sat: 'Sábado', sun: 'Domingo'
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Administração</h1>
          <p className="text-gray-500 mt-1">Gerencie a infraestrutura e regras da clínica</p>
        </div>
        <AnimatePresence>
          {successMessage && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-green-50 text-green-700 px-4 py-2 rounded-lg border border-green-200 flex items-center gap-2 shadow-sm"
            >
              <CheckCircle className="w-4 h-4" />
              {successMessage}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 overflow-x-auto">
        {[
          { id: 'doctors', label: 'Médicos', icon: Stethoscope },
          { id: 'rooms', label: 'Salas', icon: DoorOpen },
          { id: 'users', label: 'Usuários', icon: Users },
          { id: 'exams', label: 'Exames', icon: TestTube },
          { id: 'vaccines', label: 'Vacinas', icon: Syringe },
          { id: 'config', label: 'Configurações', icon: Settings },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </div>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : (
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'doctors' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-700">Corpo Clínico</h2>
                <button 
                  onClick={() => {
                    setUserForm({ ...userForm, role: 'MEDICO' });
                    setShowForm('user');
                  }} 
                  className="btn-primary flex items-center gap-2 py-2"
                >
                  <Plus className="w-4 h-4" />
                  Novo Médico
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {doctors.map((doc) => (
                  <motion.div
                    key={doc.id}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-primary-50 rounded-full flex items-center justify-center text-primary-600">
                            <Stethoscope className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-800 text-lg">{doc.user.name}</h3>
                            <p className="text-sm font-medium text-primary-600 uppercase tracking-wider">{doc.specialty}</p>
                            <p className="text-xs text-gray-400">CRM: {doc.crm}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => startEditSchedule(doc)}
                          className="p-2 hover:bg-gray-50 rounded-xl border border-gray-100 text-gray-500 flex items-center gap-2 text-sm"
                        >
                          <Clock className="w-4 h-4" /> Agenda
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'rooms' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-700">Setores e Salas</h2>
                <button onClick={() => setShowForm('room')} className="btn-primary flex items-center gap-2 py-2">
                  <Plus className="w-4 h-4" />
                  Nova Sala
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rooms.map((room) => (
                  <div key={room.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-gray-500">
                      <DoorOpen className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800">{room.name}</h3>
                      <p className="text-xs font-bold text-gray-400 uppercase">{room.sector}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-700">Usuários do Sistema</h2>
                <button 
                  onClick={() => {
                    setUserForm({ ...userForm, role: 'PACIENTE' });
                    setShowForm('user');
                  }} 
                  className="btn-primary flex items-center gap-2 py-2"
                >
                  <Plus className="w-4 h-4" />
                  Novo Usuário
                </button>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Usuário</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Email</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Cargo</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Gestão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            u.role === 'ADMIN' ? 'bg-purple-50 text-purple-600' : 'bg-gray-50 text-gray-600'
                          }`}>
                            {u.role === 'ADMIN' ? <Shield className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
                          </div>
                          <span className="font-semibold text-gray-700">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          u.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                          u.role === 'MEDICO' ? 'bg-blue-100 text-blue-800' :
                          u.role === 'RECEPCIONISTA' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select 
                          value={u.role}
                          onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                          disabled={u.id === currentUser?.id}
                          className="text-sm border-gray-200 rounded-xl focus:ring-primary-500 focus:border-primary-500 bg-gray-50 px-3 py-1"
                        >
                          <option value="PACIENTE">Paciente</option>
                          <option value="RECEPCIONISTA">Recepcionista</option>
                          <option value="MEDICO">Médico</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          )}

          {(activeTab === 'exams' || activeTab === 'vaccines') && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-700">
                  {activeTab === 'exams' ? 'Tipos de Exames' : 'Catálogo de Vacinas'}
                </h2>
                <button 
                  onClick={() => setShowForm(activeTab === 'exams' ? 'exam' : 'vaccine')} 
                  className="btn-primary flex items-center gap-2 py-2"
                >
                  <Plus className="w-4 h-4" />
                  {activeTab === 'exams' ? 'Novo Exame' : 'Nova Vacina'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(activeTab === 'exams' ? examTypes : vaccineTypes).map((item) => (
                  <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-500">
                        {activeTab === 'exams' ? <TestTube className="w-5 h-5" /> : <Syringe className="w-5 h-5" />}
                      </div>
                      <button 
                        onClick={() => handleDeleteCatalogItem(item.id)}
                        className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <h3 className="font-bold text-gray-800">{item.name}</h3>
                    {(item as any).default_dosage && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded uppercase tracking-wider">
                        {(item as any).default_dosage}
                      </span>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        (item as any).stock > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                      }`}>
                        Estoque: {(item as any).stock || 0}
                        {(item as any).stock === 0 && ' (Sem Estoque)'}
                      </span>
                    </div>
                    {item.description && <p className="text-sm text-gray-500 mt-1">{item.description}</p>}
                    
                    {activeTab === 'vaccines' && (
                      <div className="flex gap-2 mt-4">
                        <button 
                          onClick={() => handleUpdateStock(item.id, 1)}
                          className="flex-1 py-1 text-[10px] font-bold bg-gray-50 hover:bg-primary-50 text-gray-600 hover:text-primary-600 rounded-lg border border-gray-100 transition-colors"
                        >
                          + 1 Unid.
                        </button>
                        <button 
                          onClick={() => handleUpdateStock(item.id, -1)}
                          disabled={(item as any).stock <= 0}
                          className="flex-1 py-1 text-[10px] font-bold bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-red-600 rounded-lg border border-gray-100 transition-colors disabled:opacity-50"
                        >
                          - 1 Unid.
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'config' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-2xl">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Settings className="w-6 h-6 text-primary-600" /> Parâmetros do Sistema
              </h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Intervalo das Consultas (Minutos)</label>
                  <p className="text-xs text-gray-400 mb-3">Define o tempo padrão de cada slot na agenda (Ex: 30, 45, 60).</p>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      value={clinicConfig.consultation_interval}
                      onChange={(e) => setClinicConfig({ ...clinicConfig, consultation_interval: Number(e.target.value) })}
                      className="input-field max-w-[120px]"
                      min="5"
                      max="120"
                    />
                    <button 
                      onClick={handleSaveConfig}
                      disabled={submitting}
                      className="btn-primary flex items-center gap-2 px-6"
                    >
                      <Save className="w-4 h-4" /> Salvar Configuração
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-700 text-sm">
                  <p className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5" />
                    Alterar o intervalo afetará apenas os novos agendamentos e a visualização da agenda. Agendamentos antigos permanecem no horário original.
                  </p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Modals for creation */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">
                  {showForm === 'doctor' && 'Novo Médico'}
                  {showForm === 'room' && 'Nova Sala'}
                  {showForm === 'exam' && 'Novo Tipo de Exame'}
                  {showForm === 'vaccine' && 'Novo Tipo de Vacina'}
                </h2>
                <button onClick={() => setShowForm(null)} className="p-2 hover:bg-gray-100 rounded-xl">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="p-8">
                {showForm === 'user' && (
                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nome Completo</label>
                        <input type="text" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} placeholder="Ex: João Silva" className="input-field" required />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">E-mail</label>
                        <input type="email" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} placeholder="email@exemplo.com" className="input-field" required />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Senha</label>
                        <input type="password" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} placeholder="******" className="input-field" required />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Cargo</label>
                        <select 
                          value={userForm.role} 
                          onChange={e => setUserForm({...userForm, role: e.target.value as any})}
                          className="input-field"
                        >
                          <option value="PACIENTE">Paciente</option>
                          <option value="RECEPCIONISTA">Recepcionista</option>
                          <option value="MEDICO">Médico</option>
                          <option value="ADMIN">Administrador</option>
                        </select>
                      </div>
                    </div>

                    {userForm.role === 'MEDICO' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">CRM</label>
                          <input type="text" value={userForm.crm} onChange={e => setUserForm({...userForm, crm: e.target.value})} placeholder="CRM/UF" className="input-field" required />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Especialidade</label>
                          <input type="text" value={userForm.specialty} onChange={e => setUserForm({...userForm, specialty: e.target.value})} placeholder="Ex: Clínica Geral" className="input-field" required />
                        </div>
                      </motion.div>
                    )}

                    {userForm.role === 'PACIENTE' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="grid grid-cols-2 gap-4 pt-2">
                        <div className="col-span-2">
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Telefone</label>
                          <input type="text" value={userForm.phone} onChange={e => setUserForm({...userForm, phone: e.target.value})} placeholder="(00) 00000-0000" className="input-field" />
                        </div>
                      </motion.div>
                    )}

                    <button type="submit" disabled={submitting} className="btn-primary w-full py-3 mt-4">
                      {submitting ? 'Criando...' : 'Criar Usuário'}
                    </button>
                  </form>
                )}

                {showForm === 'room' && (
                  <form onSubmit={handleCreateRoom} className="space-y-4">
                    <input type="text" value={roomForm.name} onChange={e => setRoomForm({...roomForm, name: e.target.value})} placeholder="Nome da Sala" className="input-field" required />
                    <select value={roomForm.sector} onChange={e => setRoomForm({...roomForm, sector: e.target.value})} className="input-field">
                      <option value="CONSULTORIO">Consultório</option>
                      <option value="TRIAGEM">Triagem</option>
                      <option value="EXAMES">Exames</option>
                    </select>
                    <button type="submit" className="btn-primary w-full py-3">Criar Sala</button>
                  </form>
                )}

                {(showForm === 'exam' || showForm === 'vaccine') && (
                  <form onSubmit={handleCreateCatalogItem} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                      <input
                        type="text"
                        value={catalogForm.name}
                        onChange={(e) => setCatalogForm({ ...catalogForm, name: e.target.value })}
                        className="input-field"
                        placeholder={showForm === 'exam' ? 'Ex: Hemograma' : 'Ex: V10'}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {showForm === 'exam' ? 'Descrição' : 'Descrição/Observações'}
                      </label>
                      <textarea
                        value={catalogForm.description}
                        onChange={(e) => setCatalogForm({ ...catalogForm, description: e.target.value })}
                        className="input-field"
                        rows={2}
                        placeholder="Breve descrição..."
                      />
                    </div>
                    {showForm === 'vaccine' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Dosagem Padrão (ml, dose, etc)</label>
                        <input
                          type="text"
                          value={catalogForm.default_dosage}
                          onChange={(e) => setCatalogForm({ ...catalogForm, default_dosage: e.target.value })}
                          className="input-field"
                          placeholder="Ex: 1ml"
                        />
                      </div>
                    )}
                    {showForm === 'vaccine' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Inicial</label>
                        <input
                          type="number"
                          value={catalogForm.stock}
                          onChange={(e) => setCatalogForm({ ...catalogForm, stock: Number(e.target.value) })}
                          className="input-field"
                          min="0"
                        />
                      </div>
                    )}
                    <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
                      {submitting ? 'Salvando...' : 'Adicionar ao Catálogo'}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Schedule Edit Modal (Keep existing) */}
        {editingSchedule && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Escala Médica</h2>
                    <p className="text-xs text-gray-500">Configure os horários de atendimento</p>
                  </div>
                </div>
                <button onClick={() => setEditingSchedule(null)} className="p-2 hover:bg-gray-200 rounded-lg">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="p-8 max-h-[70vh] overflow-y-auto">
                <div className="space-y-6">
                  {Object.keys(daysLabels).map((day) => (
                    <div key={day} className="flex flex-col md:flex-row md:items-start gap-4 p-4 rounded-2xl bg-gray-50/50 border border-gray-100">
                      <div className="w-32 pt-2">
                        <span className="font-bold text-gray-700">{daysLabels[day]}</span>
                      </div>
                      <div className="flex-1 space-y-2">
                        {(scheduleDraft[day] || []).map((range: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={range}
                              onChange={(e) => updateTimeRange(day, idx, e.target.value)}
                              placeholder="08:00-12:00"
                              className="input-field py-1.5 text-sm"
                            />
                            <button 
                              onClick={() => removeTimeRange(day, idx)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button 
                          onClick={() => addTimeRange(day)}
                          className="text-xs text-primary-600 font-bold hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Adicionar Período
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/50">
                <button onClick={() => setEditingSchedule(null)} className="px-6 py-2.5 text-sm font-medium text-gray-500">
                  Cancelar
                </button>
                <button
                  onClick={() => saveSchedule(editingSchedule)}
                  disabled={submitting}
                  className="btn-primary px-10 py-2.5 text-sm font-bold shadow-lg"
                >
                  {submitting ? 'Salvando...' : 'Salvar Escala'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}