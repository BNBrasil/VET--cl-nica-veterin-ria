import { useEffect, useState } from 'react';
import api from '../api/axios';
import { Vaccine } from '../types';
import { useAuthStore } from '../stores/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Syringe, Plus, Loader, X, Calendar, Shield, Trash2, CheckCircle, AlertCircle } from 'lucide-react';

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Vacinas</h1>
          <p className="text-gray-500 mt-1">Histórico de vacinação da clínica</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
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
                <div className="flex items-center justify-between">
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
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Registrar Vacinação</h2>
                  <p className="text-xs text-gray-500">Aplique uma ou mais vacinas em lote</p>
                </div>
                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-6">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">1. Selecione o Animal *</label>
                  <select
                    value={formData.animalId}
                    onChange={(e) => setFormData({ ...formData, animalId: e.target.value })}
                    className="input-field"
                    required
                  >
                    <option value="">Selecione o paciente...</option>
                    {animals.map((animal) => (
                      <option key={animal.id} value={animal.id}>{animal.name} ({animal.tutor.user.name})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">2. Adicionar Vacinas do Catálogo</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {catalog.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => addVaccineToForm(item.id)}
                        disabled={item.stock <= 0}
                        className={`p-3 rounded-2xl border-2 text-left transition-all group ${
                          item.stock > 0 
                          ? 'border-gray-50 hover:border-primary-200 bg-gray-50 hover:bg-primary-50/50' 
                          : 'opacity-50 cursor-not-allowed bg-gray-100 border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Syringe className={`w-4 h-4 ${item.stock > 0 ? 'text-primary-600' : 'text-gray-400'}`} />
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                            item.stock > 0 ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-500'
                          }`}>
                            Qtd: {item.stock}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-gray-800 line-clamp-1">{item.name}</p>
                        <p className="text-[9px] text-gray-400 font-bold">{item.default_dosage || 'Dose padrão'}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {formData.vaccinations.length > 0 && (
                  <div className="space-y-4 pt-6 border-t border-gray-100">
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">3. Detalhes das Aplicações</label>
                    <div className="space-y-3">
                      {formData.vaccinations.map((v, idx) => (
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          key={idx} 
                          className="p-4 rounded-2xl bg-primary-50/30 border border-primary-100"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-bold text-primary-700 flex items-center gap-2">
                              <CheckCircle className="w-4 h-4" /> {v.name}
                            </span>
                            <button onClick={() => removeVaccineFromForm(idx)} className="text-red-400 hover:text-red-600">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                              <label className="text-[10px] font-bold text-gray-400 uppercase">Dose</label>
                              <input 
                                type="text" 
                                value={v.dosage} 
                                onChange={(e) => updateVaccination(idx, 'dosage', e.target.value)}
                                className="w-full bg-white border-gray-200 rounded-lg text-xs py-1 px-2"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-gray-400 uppercase">Data</label>
                              <input 
                                type="date" 
                                value={v.application_date} 
                                onChange={(e) => updateVaccination(idx, 'application_date', e.target.value)}
                                className="w-full bg-white border-gray-200 rounded-lg text-xs py-1 px-2"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-gray-400 uppercase">Reforço</label>
                              <input 
                                type="date" 
                                value={v.next_dose_date} 
                                onChange={(e) => updateVaccination(idx, 'next_dose_date', e.target.value)}
                                className="w-full bg-white border-gray-200 rounded-lg text-xs py-1 px-2"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-gray-400 uppercase">Lote</label>
                              <input 
                                type="text" 
                                value={v.batch} 
                                onChange={(e) => updateVaccination(idx, 'batch', e.target.value)}
                                className="w-full bg-white border-gray-200 rounded-lg text-xs py-1 px-2"
                                placeholder="BATCH"
                              />
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
                <button onClick={() => setShowForm(false)} className="px-6 py-2 text-sm font-bold text-gray-400 hover:text-gray-600">
                  Cancelar
                </button>
                <button 
                  onClick={handleSubmit} 
                  disabled={submitting || formData.vaccinations.length === 0}
                  className="btn-primary px-10 py-2.5 text-sm shadow-lg shadow-primary-200 disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : `Registrar ${formData.vaccinations.length} Vacinas`}
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