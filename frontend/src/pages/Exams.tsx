import { useEffect, useState } from 'react';
import api from '../api/axios';
import { RequestedExam, ExamType } from '../types';
import { motion } from 'framer-motion';
import { TestTube, Plus, Loader, X, Download } from 'lucide-react';
import AnimalSearchPicker from '../components/AnimalSearchPicker';

const formatAssetPath = (path: string | null) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const normalized = path.replace(/\\/g, '/');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

export default function Exams() {
  const [exams, setExams] = useState<RequestedExam[]>([]);
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [animals, setAnimals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    animalId: '',
    examTypeId: '',
    doctorId: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchExams();
    fetchExamTypes();
    fetchDoctors();
    fetchAnimals();
  }, []);

  const fetchExams = async () => {
    try {
      const response = await api.get('/exams');
      setExams(response.data.exams || []);
    } catch (error) {
      console.error('Error fetching exams:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExamTypes = async () => {
    try {
      const response = await api.get('/exams/types');
      setExamTypes(response.data.examTypes || []);
    } catch (error) {
      console.error('Error fetching exam types:', error);
    }
  };

  const fetchDoctors = async () => {
    try {
      const response = await api.get('/clinic/doctors');
      setDoctors(response.data.doctors || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/exams', formData);
      setShowForm(false);
      setFormData({ animalId: '', examTypeId: '', doctorId: '' });
      fetchExams();
    } catch (error) {
      console.error('Error creating exam:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const statusColors: any = {
    SOLICITADO: 'bg-yellow-100 text-yellow-700',
    REALIZADO: 'bg-green-100 text-green-700',
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
          <h1 className="text-2xl font-bold text-gray-800">Exames</h1>
          <p className="text-gray-500 mt-1">Gerencie solicitações e resultados</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto">
          <Plus className="w-5 h-5" />
          Solicitar Exame
        </button>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.95, y: 15 }}
            animate={{ scale: 1, y: 0 }}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-slate-100 bg-white p-5 shadow-2xl sm:p-8"
          >
            <div className="mb-8 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Solicitar Exame</h2>
                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-extrabold">Nova requisição de exame clínico</p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 hover:text-slate-700 text-slate-400 rounded-full transition-all duration-300 hover:rotate-90">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <AnimalSearchPicker
                animals={animals}
                value={formData.animalId}
                onChange={(animalId) => setFormData({ ...formData, animalId })}
                label="Animal"
                required
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tipo de Exame *</label>
                <select
                  value={formData.examTypeId}
                  onChange={(e) => setFormData({ ...formData, examTypeId: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all duration-300 outline-none text-sm cursor-pointer"
                  required
                >
                  <option value="">Selecione o tipo de exame...</option>
                  {examTypes.map((type) => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Médico Solicitante *</label>
                <select
                  value={formData.doctorId}
                  onChange={(e) => setFormData({ ...formData, doctorId: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all duration-300 outline-none text-sm cursor-pointer"
                  required
                >
                  <option value="">Selecione o médico...</option>
                  {doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>{doc.user.name}</option>
                  ))}
                </select>
              </div>

              <button type="submit" disabled={submitting} className="w-full mt-4 py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer">
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Solicitando...
                  </>
                ) : (
                  'Solicitar Exame'
                )}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}

      <div className="space-y-4">
        {exams.map((exam) => (
          <motion.div
            key={exam.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <TestTube className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-800">{exam.exam_type.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[exam.status]}`}>
                      {exam.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{exam.animal.name} - {exam.animal.species}</p>
                  <p className="text-sm text-gray-500">
                    Solicitado por: {exam.doctor.user.name} | {new Date(exam.request_date).toLocaleDateString('pt-BR')}
                  </p>
                  {exam.result_text && (
                    <p className="mt-2 text-sm bg-gray-50 p-2 rounded">{exam.result_text}</p>
                  )}
                </div>
              </div>
              {exam.file_path && (
                <a
                  href={formatAssetPath(exam.file_path)}
                  target="_blank"
                  rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-100 px-4 py-2 text-primary-700 hover:bg-primary-200 sm:w-auto"
                >
                  <Download className="w-4 h-4" />
                  Baixar
                </a>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {exams.length === 0 && (
        <div className="text-center py-12">
          <TestTube className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Nenhum exame encontrado</p>
        </div>
      )}
    </div>
  );
}
