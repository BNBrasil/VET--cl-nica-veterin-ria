import { useEffect, useState } from 'react';
import api from '../api/axios';
import { RequestedExam, ExamType } from '../types';
import { motion } from 'framer-motion';
import { TestTube, Plus, Loader, X, Download } from 'lucide-react';

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Exames</h1>
          <p className="text-gray-500 mt-1">Gerencie solicitações e resultados</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Solicitar Exame
        </button>
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
            className="bg-white rounded-2xl p-6 w-full max-w-lg"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">Solicitar Exame</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Animal *</label>
                <select
                  value={formData.animalId}
                  onChange={(e) => setFormData({ ...formData, animalId: e.target.value })}
                  className="input-field"
                  required
                >
                  <option value="">Selecione</option>
                  {animals.map((animal) => (
                    <option key={animal.id} value={animal.id}>{animal.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Exame *</label>
                <select
                  value={formData.examTypeId}
                  onChange={(e) => setFormData({ ...formData, examTypeId: e.target.value })}
                  className="input-field"
                  required
                >
                  <option value="">Selecione</option>
                  {examTypes.map((type) => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Médico Solicitante *</label>
                <select
                  value={formData.doctorId}
                  onChange={(e) => setFormData({ ...formData, doctorId: e.target.value })}
                  className="input-field"
                  required
                >
                  <option value="">Selecione</option>
                  {doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>{doc.user.name}</option>
                  ))}
                </select>
              </div>

              <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
                {submitting ? 'Solicitando...' : 'Solicitar Exame'}
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
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
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
                  href={exam.file_path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200"
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