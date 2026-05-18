import { useEffect, useState } from 'react';
import api from '../api/axios';
import { Appointment } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, User, PawPrint, Plus, Loader, X, Stethoscope, Clock, CheckCircle2, ChevronRight, Search, AlertCircle } from 'lucide-react';

export default function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState(1);
  
  // Data for selects
  const [animals, setAnimals] = useState<any[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [examTypes, setExamTypes] = useState<any[]>([]);
  const [allDoctors, setAllDoctors] = useState<any[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  
  // Selection state
  const [bookingType, setBookingType] = useState<'CONSULTA' | 'EXAME'>('CONSULTA');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [formData, setFormData] = useState({
    animalId: '',
    specialty: '',
    doctorId: '',
    examTypeId: '',
    date: '',
    time: '',
    observation: '',
  });
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAppointments();
    fetchAnimals();
    fetchSpecialties();
    fetchExamTypes();
    fetchAllDoctors();
  }, []);

  const fetchAppointments = async () => {
    try {
      const response = await api.get('/appointments');
      setAppointments(response.data.appointments || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
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

  const fetchSpecialties = async () => {
    try {
      const response = await api.get('/appointments/specialties');
      setSpecialties(response.data.specialties || []);
    } catch (error) {
      console.error('Error fetching specialties:', error);
    }
  };

  const fetchExamTypes = async () => {
    try {
      const response = await api.get('/catalog/exams');
      setExamTypes(response.data.exams || []);
    } catch (error) {
      console.error('Error fetching exams:', error);
    }
  };

  const fetchAllDoctors = async () => {
    try {
      const response = await api.get('/clinic/doctors');
      setAllDoctors(response.data.doctors || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const fetchDoctorsBySpecialty = async (specialty: string) => {
    try {
      const response = await api.get(`/appointments/doctors-by-specialty?specialty=${specialty}`);
      setDoctors(response.data.doctors || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const fetchSlots = async (id: string, type: 'doctor' | 'exam', date: string) => {
    try {
      const param = type === 'doctor' ? `doctorId=${id}` : `examTypeId=${id}`;
      const response = await api.get(`/appointments/available-slots?${param}&date=${date}`);
      setAvailableSlots(response.data.slots || []);
    } catch (error) {
      console.error('Error fetching slots:', error);
      setAvailableSlots([]);
    }
  };

  const handleSpecialtyChange = (specialty: string) => {
    setFormData({ ...formData, specialty, doctorId: '', date: '', time: '' });
    fetchDoctorsBySpecialty(specialty);
    setStep(2);
  };

  const handleExamTypeChange = (examTypeId: string) => {
    setFormData({ ...formData, examTypeId, doctorId: '', date: '', time: '' });
    setStep(2);
  };

  const handleDoctorChange = (doctorId: string) => {
    setFormData({ ...formData, doctorId, date: '', time: '' });
    setStep(3);
  };

  const handleDateChange = (date: string) => {
    setFormData({ ...formData, date, time: '' });
    if (bookingType === 'CONSULTA' && formData.doctorId) {
      fetchSlots(formData.doctorId, 'doctor', date);
    } else if (bookingType === 'EXAME' && formData.examTypeId) {
      fetchSlots(formData.examTypeId, 'exam', date);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const datetime = `${formData.date}T${formData.time}:00Z`;
      if (bookingType === 'CONSULTA') {
        await api.post('/appointments', {
          animalId: formData.animalId,
          doctorId: formData.doctorId,
          appointment_datetime: datetime,
          observation: formData.observation,
        });
      } else {
        await api.post('/exams', {
          animalId: formData.animalId,
          doctorId: formData.doctorId, // Solicitante
          examTypeId: formData.examTypeId,
          execution_date: datetime,
          result_text: formData.observation,
        });
      }
      setShowForm(false);
      resetForm();
      fetchAppointments();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao realizar agendamento');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ animalId: '', specialty: '', doctorId: '', examTypeId: '', date: '', time: '', observation: '' });
    setBookingType('CONSULTA');
    setStep(1);
    setAvailableSlots([]);
    setError('');
  };

  const getEnabledDays = () => {
    let configStr = null;
    if (bookingType === 'CONSULTA' && formData.doctorId) {
      const doc = doctors.find(d => d.id === formData.doctorId);
      configStr = doc?.schedule_config;
    } else if (bookingType === 'EXAME' && formData.examTypeId) {
      const exam = examTypes.find(e => e.id === formData.examTypeId);
      configStr = exam?.schedule_config;
    }

    if (!configStr) return [];

    try {
      const config = JSON.parse(configStr);
      const dayMap: any = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
      return Object.keys(config).filter(k => config[k] && config[k].length > 0).map(k => dayMap[k]);
    } catch {
      return [];
    }
  };

  const statusColors: any = {
    AGENDADA: 'bg-blue-100 text-blue-700',
    EM_ATENDIMENTO: 'bg-yellow-100 text-yellow-700',
    CONCLUIDA: 'bg-green-100 text-green-700',
    FALTOU: 'bg-red-100 text-red-700',
    CANCELADA: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Agendamentos</h1>
          <p className="text-gray-500 mt-1">Gerencie consultas com especialistas</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Nova Consulta
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Novo Agendamento</h2>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                      <span className={step >= 1 ? 'text-primary-600 font-bold' : ''}>{bookingType === 'CONSULTA' ? 'Especialidade' : 'Tipo de Exame'}</span>
                      <ChevronRight className="w-3 h-3" />
                      <span className={step >= 2 ? 'text-primary-600 font-bold' : ''}>Médico</span>
                      <ChevronRight className="w-3 h-3" />
                      <span className={step >= 3 ? 'text-primary-600 font-bold' : ''}>Horário</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => { setShowForm(false); resetForm(); }} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="p-8 max-h-[70vh] overflow-y-auto">
                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> {error}
                  </div>
                )}

                <div className="space-y-8">
                  <div className="space-y-4">
                    <label className="block text-sm font-semibold text-gray-700">Selecione seu Pet</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {animals.map((animal) => (
                        <button
                          key={animal.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, animalId: animal.id })}
                          className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                            formData.animalId === animal.id 
                            ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-100' 
                            : 'border-gray-100 hover:border-primary-200 bg-white'
                          }`}
                        >
                          <div className="w-12 h-12 bg-gray-100 rounded-full overflow-hidden">
                            {animal.photo_url ? (
                              <img src={animal.photo_url} alt={animal.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <PawPrint className="w-6 h-6" />
                              </div>
                            )}
                          </div>
                          <span className="text-sm font-medium">{animal.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Booking Type Selection */}
                  {formData.animalId && (
                    <div className="space-y-4">
                      <label className="block text-sm font-semibold text-gray-700">O que deseja agendar?</label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { type: 'CONSULTA', label: 'Consulta Médica', icon: Stethoscope },
                          { type: 'EXAME', label: 'Exame Veterinário', icon: Search }
                        ].map((option) => (
                          <button
                            key={option.type}
                            type="button"
                            onClick={() => {
                              setBookingType(option.type as any);
                              setFormData({ ...formData, specialty: '', examTypeId: '', doctorId: '', date: '', time: '' });
                              setStep(1);
                            }}
                            className={`p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                              bookingType === option.type 
                              ? 'border-primary-600 bg-primary-50' 
                              : 'border-gray-100 hover:border-primary-200'
                            }`}
                          >
                            <option.icon className={`w-5 h-5 ${bookingType === option.type ? 'text-primary-600' : 'text-gray-400'}`} />
                            <span className="font-medium text-sm text-gray-700">{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 1: Specialties or Exams */}
                  {formData.animalId && bookingType === 'CONSULTA' && (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                      <label className="block text-sm font-semibold text-gray-700">Especialidade Desejada</label>
                      <div className="grid grid-cols-2 gap-3">
                        {specialties.map((spec) => (
                          <button
                            key={spec}
                            type="button"
                            onClick={() => handleSpecialtyChange(spec)}
                            className={`p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                              formData.specialty === spec 
                              ? 'border-primary-600 bg-primary-50' 
                              : 'border-gray-100 hover:border-primary-200'
                            }`}
                          >
                            <Stethoscope className={`w-5 h-5 ${formData.specialty === spec ? 'text-primary-600' : 'text-gray-400'}`} />
                            <span className="font-medium text-sm text-gray-700">{spec}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {formData.animalId && bookingType === 'EXAME' && (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                      <label className="block text-sm font-semibold text-gray-700">Tipo de Exame Desejado</label>
                      <div className="grid grid-cols-2 gap-3">
                        {examTypes.map((exam) => (
                          <button
                            key={exam.id}
                            type="button"
                            onClick={() => handleExamTypeChange(exam.id)}
                            className={`p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                              formData.examTypeId === exam.id 
                              ? 'border-primary-600 bg-primary-50' 
                              : 'border-gray-100 hover:border-primary-200'
                            }`}
                          >
                            <Search className={`w-5 h-5 ${formData.examTypeId === exam.id ? 'text-primary-600' : 'text-gray-400'}`} />
                            <span className="font-medium text-sm text-gray-700">{exam.name}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Step 2: Doctors */}
                  {((bookingType === 'CONSULTA' && formData.specialty) || (bookingType === 'EXAME' && formData.examTypeId)) && (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                      <label className="block text-sm font-semibold text-gray-700">
                        {bookingType === 'CONSULTA' ? 'Médico Especialista' : 'Médico Solicitante'}
                      </label>
                      <div className="grid grid-cols-1 gap-3">
                        {(bookingType === 'CONSULTA' ? doctors : allDoctors).map((doc) => (
                          <button
                            key={doc.id}
                            type="button"
                            onClick={() => handleDoctorChange(doc.id)}
                            className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between ${
                              formData.doctorId === doc.id 
                              ? 'border-primary-600 bg-primary-50' 
                              : 'border-gray-100 hover:border-primary-200'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                                <User className="w-5 h-5 text-gray-500" />
                              </div>
                              <div className="text-left">
                                <p className="font-semibold text-gray-800">{doc.user.name}</p>
                                <p className="text-xs text-gray-500">CRM: {doc.crm}</p>
                              </div>
                            </div>
                            {formData.doctorId === doc.id && <CheckCircle2 className="w-5 h-5 text-primary-600" />}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3: Date & Slots */}
                  {formData.doctorId && ((bookingType === 'CONSULTA') || (bookingType === 'EXAME' && formData.examTypeId)) && (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                      <div className="space-y-4">
                        <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-primary-600" />
                          Próximas Datas Disponíveis
                        </label>
                        
                        {/* Novo Seletor de Datas Filtrado */}
                        {(() => {
                          const enabledDays = getEnabledDays();
                          const availableDates = [];
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);

                          // Procurar datas disponíveis nos próximos 60 dias
                          for (let i = 0; i < 60; i++) {
                            const date = new Date();
                            date.setDate(today.getDate() + i);
                            if (enabledDays.includes(date.getDay())) {
                              availableDates.push(new Date(date));
                            }
                            if (availableDates.length >= 12) break; // Mostra as primeiras 12 datas encontradas
                          }

                          const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
                          const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

                          if (availableDates.length === 0) {
                            return (
                              <div className="p-8 text-center bg-red-50 border border-red-100 rounded-2xl">
                                <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                                <p className="text-red-600 font-bold">Nenhuma data disponível encontrada</p>
                                <p className="text-red-400 text-xs mt-1">Verifique a escala de horários no painel administrativo.</p>
                              </div>
                            );
                          }

                          return (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {availableDates.map((date, idx) => {
                                const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                                const selected = formData.date === formattedDate;
                                
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleDateChange(formattedDate)}
                                    className={`p-4 rounded-2xl border-2 transition-all text-left flex flex-col gap-1 relative overflow-hidden ${
                                      selected 
                                      ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-100' 
                                      : 'border-gray-100 hover:border-primary-200 bg-white shadow-sm'
                                    }`}
                                  >
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${selected ? 'text-primary-600' : 'text-gray-400'}`}>
                                      {dayNames[date.getDay()]}
                                    </span>
                                    <span className={`text-lg font-bold ${selected ? 'text-primary-800' : 'text-gray-700'}`}>
                                      {date.getDate()} {monthNames[date.getMonth()]}
                                    </span>
                                    {selected && (
                                      <div className="absolute top-2 right-2">
                                        <CheckCircle2 className="w-4 h-4 text-primary-600" />
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>

                      {formData.date && (
                        <div className="space-y-4">
                          <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Clock className="w-4 h-4" /> Horários Disponíveis
                          </label>
                          {availableSlots.length > 0 ? (
                            <div className="grid grid-cols-4 gap-2">
                              {availableSlots.map((slot) => (
                                <button
                                  key={slot}
                                  type="button"
                                  onClick={() => setFormData({ ...formData, time: slot })}
                                  className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                                    formData.time === slot 
                                    ? 'bg-primary-600 text-white border-primary-600 shadow-md' 
                                    : 'bg-white border-gray-200 text-gray-600 hover:border-primary-400'
                                  }`}
                                >
                                  {slot}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="p-4 bg-gray-50 rounded-xl text-center text-sm text-gray-500">
                              Nenhum horário disponível para esta data.
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {formData.time && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <label className="block text-sm font-semibold text-gray-700">Observações adicionais</label>
                      <textarea
                        value={formData.observation}
                        onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
                        className="input-field"
                        rows={3}
                        placeholder="Ex: Animal está apático e sem apetite..."
                      />
                    </motion.div>
                  )}
                </div>
              </div>

              <div className="p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="px-6 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !formData.time || !formData.animalId}
                  className="btn-primary px-10 py-2.5 text-sm font-bold shadow-lg shadow-primary-200 disabled:opacity-50"
                >
                  {submitting ? 'Processando...' : 'Finalizar Agendamento'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Appointment List Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : appointments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Paciente</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Especialista</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Data / Hora</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {appointments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-600">
                          <PawPrint className="w-5 h-5" />
                        </div>
                        <span className="font-semibold text-gray-700">{apt.animal?.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-800">{apt.doctor?.user?.name}</span>
                        <span className="text-[11px] text-gray-400 uppercase font-bold">{apt.doctor?.specialty}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4 text-gray-300" />
                        {new Date(apt.appointment_datetime).toLocaleString('pt-BR')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${statusColors[apt.status]}`}>
                        {apt.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-20 bg-gray-50/30">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Search className="w-8 h-8 text-gray-200" />
            </div>
            <p className="text-gray-400 font-medium">Nenhum agendamento encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}