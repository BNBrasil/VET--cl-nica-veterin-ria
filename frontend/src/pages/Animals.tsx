import { useEffect, useState } from 'react';
import api from '../api/axios';
import { Animal } from '../types';
import { motion } from 'framer-motion';
import { Plus, Search, PawPrint, X, Camera, Loader } from 'lucide-react';

export default function Animals() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    species: '',
    breed: '',
    birth_date: '',
    weight: '',
    allergies: '',
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAnimals();
  }, []);

  const fetchAnimals = async () => {
    try {
      const response = await api.get('/animals');
      setAnimals(response.data.animals || []);
    } catch (error) {
      console.error('Error fetching animals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const formDataToSend = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (value) formDataToSend.append(key, value);
    });
    if (photo) formDataToSend.append('photo', photo);

    try {
      await api.post('/animals', formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setShowForm(false);
      setFormData({ name: '', species: '', breed: '', birth_date: '', weight: '', allergies: '' });
      setPhoto(null);
      setPhotoPreview(null);
      fetchAnimals();
    } catch (error) {
      console.error('Error creating animal:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const filteredAnimals = animals.filter(animal =>
    animal.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <h1 className="text-2xl font-bold text-gray-800">Animais</h1>
          <p className="text-gray-500 mt-1">Gerencie os pets cadastrados</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Novo Animal
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-field pl-11"
        />
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">Novo Animal</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex justify-center mb-4">
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                  <div className="w-32 h-32 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <p className="text-center text-sm text-gray-500 mt-2">Foto do animal</p>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Espécie *</label>
                  <select
                    value={formData.species}
                    onChange={(e) => setFormData({ ...formData, species: e.target.value })}
                    className="input-field"
                    required
                  >
                    <option value="">Selecione</option>
                    <option value="Cachorro">Cachorro</option>
                    <option value="Gato">Gato</option>
                    <option value="Pássaro">Pássaro</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Raça *</label>
                  <input
                    type="text"
                    value={formData.breed}
                    onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento *</label>
                  <input
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Peso (kg) *</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alergias</label>
                <textarea
                  value={formData.allergies}
                  onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                  className="input-field"
                  rows={2}
                  placeholder="Alergias conhecidas..."
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full py-3"
              >
                {submitting ? 'Salvando...' : 'Salvar Animal'}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAnimals.map((animal) => (
          <motion.div
            key={animal.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="h-32 bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center">
              {animal.photo_url ? (
                <img src={animal.photo_url} alt={animal.name} className="w-24 h-24 rounded-full object-cover border-4 border-white" />
              ) : (
                <PawPrint className="w-16 h-16 text-primary-300" />
              )}
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-gray-800 text-lg">{animal.name}</h3>
              <p className="text-sm text-gray-500">{animal.species} - {animal.breed}</p>
              <div className="mt-3 flex gap-2 text-xs text-gray-500">
                <span className="bg-gray-100 px-2 py-1 rounded">Peso: {animal.weight}kg</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredAnimals.length === 0 && (
        <div className="text-center py-12">
          <PawPrint className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Nenhum animal encontrado</p>
        </div>
      )}
    </div>
  );
}