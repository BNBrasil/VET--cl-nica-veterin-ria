import { useEffect, useState } from 'react';
import api from '../api/axios';
import { Vaccine } from '../types';
import { useAuthStore } from '../stores/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Syringe, Plus, Loader, X, Calendar, Shield, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import AnimalSearchPicker from '../components/AnimalSearchPicker';

interface CatalogItem {
  id: string;
  name: string;
  default_dosage?: string;
  stock: number;
}

export default function Vaccines() {
  const { user } = useAuthStore();
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [animals, setAnimals] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [formData, setFormData] = useState({
    animalId: '',
    vaccinations: [] as { vaccineTypeId: string; name: string; dosage: string; application_date: string; next_dose_date: string; batch: string }[],
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchVaccines();
    fetchAnimals();
    fetchCatalog();
  }, []);

  const fetchVaccines = async () => {
    try {
      const response = await api.get('/vaccines');
      setVaccines(response.data.vaccines || []);
    } catch (error) {
      console.error('Error fetching vaccines:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnimals = async () => {
    try {
      const response = await api.get('/animals');
      setAnimals(response.data.animals || []);
    } catch (error) {
      console.error('Error fetching animals:', error);
    }
  };

  const fetchCatalog = async () => {
    try {
      const response = await api.get('/catalog/vaccines');
      setCatalog(response.data.vaccines || []);
    } catch (error) {
      console.error('Error fetching catalog:', error);
    }
  };

  const addVaccineToForm = (vaccineTypeId: string) => {
    const item = catalog.find(v => v.id === vaccineTypeId);
    if (!item) return;
    
    if (item.stock <= 0) {
      alert(`Vacina ${item.name} sem estoque!`);
      return;
    }

    setFormData(prev => ({
      ...prev,
      vaccinations: [...prev.vaccinations, {
        vaccineTypeId: item.id,
        name: item.name,
        dosage: item.default_dosage || '',
        application_date: new Date().toISOString().split('T')[0],
        next_dose_date: '',
        batch: ''
      }]
    }));
  };

  const removeVaccineFromForm = (index: number) => {
    setFormData(prev => ({
      ...prev,
      vaccinations: prev.vaccinations.filter((_, i) => i !== index)
    }));
  };

  const updateVaccination = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      vaccinations: prev.vaccinations.map((v, i) => i === index ? { ...v, [field]: value } : v)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.animalId) {
      setError('Selecione um animal');
      return;
    }

    if (formData.vaccinations.length === 0) {
      setError('Adicione pelo menos uma vacina');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/vaccines', formData);
      setShowForm(false);
      setFormData({ animalId: '', vaccinations: [] });
      fetchVaccines();
      fetchCatalog(); // Refresh stock
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao registrar vacinas');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Deseja realmente excluir este registro? O estoque será estornado.')) return;
    try {
      await api.delete(`/vaccines/${id}`);
      fetchVaccines();
      fetchCatalog();
    } catch (error) {
      console.error('Error deleting vaccine:', error);
      alert('Falha ao excluir vacina.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-800">Vacinas</h1>
          <p className="text-gray-500 mt-1">Histórico de vacinação da clínica</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto">
          <Plus className="w-5 h-5" />
          Registrar Vacinação
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vaccines.map((vaccine) => (
          <motion.div
            key={vaccine.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
                <Syringe className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-gray-800">{vaccine.name}</h3>
                  <span className="text-[10px] font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-500">
                    {vaccine.dosage}
                  </span>
                  {user?.role === 'ADMIN' && (
                    <button 
                      onClick={() => handleDelete(vaccine.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-2"
                      title="Excluir Registro"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-sm font-semibold text-primary-600 mt-0.5">{vaccine.animal.name}</p>
                <p className="text-xs text-gray-400 mb-3">{vaccine.animal.species} • {vaccine.animal.breed}</p>
                
                <div className="space-y-2 pt-2 border-t border-gray-50">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span>Aplicada em: {new Date(vaccine.application_date).toLocaleDateString('pt-BR')}</span>
                  </div>
                  {vaccine.next_dose_date && (
                    <div className="flex items-center gap-2 text-xs text-orange-600 font-bold">
                      <Shield className="w-3.5 h-3.5" />
                      <span>Reforço: {new Date(vaccine.next_dose_date).toLocaleDateString('pt-BR')}</span>
                    </div>
                  )}
                  {vaccine.batch && (
                    <div className="text-[10px] text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-0.5 rounded inline-block">
                      Lote: {vaccine.batch}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-100 bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white p-5 sm:p-8">
                <div>
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">Registrar Vacinação</h2>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-extrabold">Aplique uma ou mais vacinas em lote</p>
                </div>
                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 hover:text-slate-700 text-slate-400 rounded-full transition-all duration-300 hover:rotate-90">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-6 overflow-y-auto p-5 sm:p-8">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500" /> {error}
                  </div>
                )}

                <AnimalSearchPicker
                  animals={animals}
                  value={formData.animalId}
                  onChange={(animalId) => setFormData({ ...formData, animalId })}
                  label="1. Selecione o Animal"
                  required
                />

                <div className="space-y-4">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">2. Adicionar Vacinas do Catálogo</label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {catalog.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => addVaccineToForm(item.id)}
                        disabled={item.stock <= 0}
                        className={`p-4 rounded-2xl border-2 text-left transition-all duration-300 group flex flex-col justify-between h-full cursor-pointer ${
                          item.stock > 0 
                          ? 'border-slate-100 bg-slate-50/50 hover:bg-white hover:border-emerald-500 hover:ring-4 hover:ring-emerald-500/5' 
                          : 'opacity-40 cursor-not-allowed bg-slate-100 border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-3">
                          <div className={`p-1.5 rounded-lg transition-colors ${item.stock > 0 ? 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white' : 'bg-slate-200 text-slate-400'}`}>
                            <Syringe className="w-4 h-4 transition-transform duration-300 group-hover:rotate-12" />
                          </div>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
                            item.stock > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                          }`}>
                            Qtd: {item.stock}
                          </span>
                        </div>
                        <p className="text-xs font-black text-slate-700 group-hover:text-slate-800 line-clamp-1">{item.name}</p>
                        <p className="text-[9px] text-slate-400 font-extrabold mt-0.5">{item.default_dosage || 'Dose padrão'}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {formData.vaccinations.length > 0 && (
                  <div className="space-y-4 pt-6 border-t border-slate-100">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">3. Detalhes das Aplicações</label>
                    <div className="space-y-3.5">
                      {formData.vaccinations.map((v, idx) => (
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          key={idx} 
                          className="p-5 rounded-2xl bg-emerald-50/20 border border-emerald-100"
                        >
                          <div className="flex items-center justify-between mb-4 pb-2 border-b border-emerald-100/30">
                            <span className="text-sm font-extrabold text-emerald-800 flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-emerald-600" /> {v.name}
                            </span>
                            <button onClick={() => removeVaccineFromForm(idx)} className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dose</label>
                              <input 
                                type="text" 
                                value={v.dosage} 
                                onChange={(e) => updateVaccination(idx, 'dosage', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all duration-300 outline-none text-xs"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data de Aplic.</label>
                              <input 
                                type="date" 
                                value={v.application_date} 
                                onChange={(e) => updateVaccination(idx, 'application_date', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all duration-300 outline-none text-xs cursor-pointer"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Próx. Reforço</label>
                              <input 
                                type="date" 
                                value={v.next_dose_date} 
                                onChange={(e) => updateVaccination(idx, 'next_dose_date', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all duration-300 outline-none text-xs cursor-pointer"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lote / Ampola</label>
                              <input 
                                type="text" 
                                value={v.batch} 
                                onChange={(e) => updateVaccination(idx, 'batch', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all duration-300 outline-none text-xs"
                                placeholder="Ex: LOTE998"
                              />
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
                <button onClick={() => setShowForm(false)} className="px-6 py-3 text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wider cursor-pointer">
                  Cancelar
                </button>
                <button 
                  onClick={handleSubmit} 
                  disabled={submitting || formData.vaccinations.length === 0}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submitting ? 'Salvando...' : `Registrar ${formData.vaccinations.length} Vacina(s)`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {vaccines.length === 0 && (
        <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
          <Syringe className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 font-medium">Nenhum registro de vacinação encontrado</p>
        </div>
      )}
    </div>
  );
}
