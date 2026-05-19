import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { Appointment, Animal, Doctor, Room } from '../types';
import { useAuthStore } from '../stores/authStore';
import AnimalSearchPicker from '../components/AnimalSearchPicker';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  Ban,
  Calendar,
  Clock,
  DoorOpen,
  Edit3,
  Loader,
  MessageSquareText,
  PawPrint,
  Plus,
  Search,
  Stethoscope,
  Trash2,
  X,
} from 'lucide-react';

const toDateTimeParts = (value?: string) => {
  if (!value) return { date: '', time: '' };
  const parsed = new Date(value);
  return {
    date: `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}-${String(parsed.getUTCDate()).padStart(2, '0')}`,
    time: `${String(parsed.getUTCHours()).padStart(2, '0')}:${String(parsed.getUTCMinutes()).padStart(2, '0')}`,
  };
};

const emptyForm = {
  animalId: '',
  doctorId: '',
  roomId: '',
  date: '',
  time: '',
  observation: '',
};

export default function Appointments() {
  const { user } = useAuthStore();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [cancelingAppointment, setCancelingAppointment] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState('');
  const [formData, setFormData] = useState(emptyForm);

  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [appointmentsRes, animalsRes, doctorsRes, roomsRes] = await Promise.all([
        api.get('/appointments'),
        api.get('/animals'),
        api.get('/clinic/doctors'),
        api.get('/clinic/rooms'),
      ]);
      setAppointments(appointmentsRes.data.appointments || []);
      setAnimals(animalsRes.data.animals || []);
      setDoctors(doctorsRes.data.doctors || []);
      setRooms(roomsRes.data.rooms || []);
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    AGENDADA: 'bg-blue-100 text-blue-700',
    EM_ATENDIMENTO: 'bg-yellow-100 text-yellow-700',
    CONCLUIDA: 'bg-green-100 text-green-700',
    FALTOU: 'bg-red-100 text-red-700',
    CANCELADA: 'bg-gray-100 text-gray-700',
  };

  const selectedDoctor = useMemo(
    () => doctors.find((doctor) => doctor.id === formData.doctorId),
    [doctors, formData.doctorId]
  );

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingAppointment(null);
    setError('');
  };

  const openNewForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (appointment: Appointment) => {
    const parts = toDateTimeParts(appointment.appointment_datetime);
    setEditingAppointment(appointment);
    setFormData({
      animalId: appointment.animalId,
      doctorId: appointment.doctorId,
      roomId: appointment.roomId || '',
      date: parts.date,
      time: parts.time,
      observation: appointment.observation || '',
    });
    setError('');
    setShowForm(true);
  };

  const saveAppointment = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const appointment_datetime = `${formData.date}T${formData.time}:00Z`;
      const payload = {
        animalId: formData.animalId,
        doctorId: formData.doctorId,
        roomId: formData.roomId || undefined,
        appointment_datetime,
        observation: formData.observation || 'Consulta agendada pela clínica',
      };

      if (editingAppointment) {
        await api.patch(`/appointments/${editingAppointment.id}`, payload);
      } else {
        await api.post('/appointments', payload);
      }

      setShowForm(false);
      resetForm();
      await fetchAll();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar agendamento.');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelAppointment = async () => {
    if (!cancelingAppointment || cancelReason.trim().length < 5) {
      setError('Informe o motivo do cancelamento.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.patch(`/appointments/${cancelingAppointment.id}/cancel`, { reason: cancelReason.trim() });
      setCancelingAppointment(null);
      setCancelReason('');
      await fetchAll();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao cancelar consulta.');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteAppointment = async (appointment: Appointment) => {
    const confirmed = window.confirm(`Excluir definitivamente a consulta de ${appointment.animal?.name}? Esta ação não pode ser desfeita.`);
    if (!confirmed) return;
    try {
      await api.delete(`/appointments/${appointment.id}`);
      await fetchAll();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao excluir consulta.');
    }
  };

  const AppointmentActions = ({ appointment }: { appointment: Appointment }) => (
    <div className="flex flex-wrap gap-2">
      {isAdmin && (
        <>
          <button
            onClick={() => openEditForm(appointment)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
          >
            <Edit3 className="h-4 w-4" /> Editar
          </button>
          <button
            onClick={() => {
              setCancelingAppointment(appointment);
              setCancelReason('');
              setError('');
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-200 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50"
          >
            <Ban className="h-4 w-4" /> Cancelar
          </button>
          <button
            onClick={() => deleteAppointment(appointment)}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" /> Excluir
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-800">Agendamentos</h1>
          <p className="text-gray-500 mt-1">Gerencie consultas com especialistas</p>
        </div>
        <button onClick={openNewForm} className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto">
          <Plus className="w-5 h-5" />
          Nova Consulta
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-4">
            <motion.div initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/70">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-b from-white to-slate-50 px-4 py-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm shadow-primary-600/25">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-black text-slate-900 sm:text-xl">{editingAppointment ? 'Editar Agendamento' : 'Nova Consulta'}</h2>
                    <p className="text-xs text-gray-500">Defina paciente, médico, data e sala</p>
                  </div>
                </div>
                <button onClick={() => { setShowForm(false); resetForm(); }} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={saveAppointment} className="flex min-h-0 flex-1 flex-col">
                <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
                  {error && (
                    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <AnimalSearchPicker
                      animals={animals}
                      value={formData.animalId}
                      onChange={(animalId) => setFormData({ ...formData, animalId })}
                      label="Animal"
                      required
                    />
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                        <Stethoscope className="h-4 w-4 text-primary-500" />
                        Médico
                      </label>
                      <select
                        value={formData.doctorId}
                        onChange={(e) => setFormData({ ...formData, doctorId: e.target.value })}
                        className="input-field h-12 rounded-xl bg-slate-50 font-semibold"
                        required
                      >
                        <option value="">Selecione...</option>
                        {doctors.map((doctor) => (
                          <option key={doctor.id} value={doctor.id}>{doctor.user.name} - {doctor.specialty}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {selectedDoctor && (
                    <div className="flex items-center gap-3 rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm font-bold text-primary-700">
                      <Stethoscope className="h-4 w-4 shrink-0" />
                      CRM {selectedDoctor.crm} · {selectedDoctor.specialty}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                        <Calendar className="h-4 w-4 text-primary-500" />
                        Data
                      </label>
                      <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="input-field h-12 rounded-xl bg-slate-50 font-semibold" required />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                        <Clock className="h-4 w-4 text-primary-500" />
                        Hora
                      </label>
                      <input type="time" value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value })} className="input-field h-12 rounded-xl bg-slate-50 font-semibold" required />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                        <DoorOpen className="h-4 w-4 text-primary-500" />
                        Sala
                      </label>
                      <select value={formData.roomId} onChange={(e) => setFormData({ ...formData, roomId: e.target.value })} className="input-field h-12 rounded-xl bg-slate-50 font-semibold">
                        <option value="">Automática</option>
                        {rooms.map((room) => (
                          <option key={room.id} value={room.id}>{room.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                      <MessageSquareText className="h-4 w-4 text-primary-500" />
                      Observações
                    </label>
                    <textarea
                      value={formData.observation}
                      onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
                      className="input-field min-h-28 resize-y rounded-xl bg-slate-50 font-medium leading-relaxed"
                      rows={3}
                      placeholder="Motivo da consulta ou informações importantes..."
                    />
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/80 p-4 sm:flex-row sm:justify-end sm:p-6">
                  <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="btn-secondary rounded-xl">
                    Cancelar
                  </button>
                  <button type="submit" disabled={submitting} className="btn-primary rounded-xl shadow-lg shadow-primary-600/20">
                    {submitting ? 'Salvando...' : editingAppointment ? 'Salvar Alterações' : 'Criar Consulta'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {cancelingAppointment && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-rose-100">
              <div className="flex items-start justify-between gap-4 border-b border-rose-100 bg-rose-50/80 p-5">
                <div className="flex min-w-0 gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-sm shadow-rose-600/25">
                    <Ban className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-black text-slate-900">Cancelar consulta</h2>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">O tutor receberá e-mail e notificação no sistema.</p>
                  </div>
                </div>
                <button onClick={() => setCancelingAppointment(null)} className="rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-slate-700" aria-label="Fechar">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4 p-5">
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>
                )}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                    <MessageSquareText className="h-4 w-4 text-rose-500" />
                    Motivo do cancelamento *
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="input-field min-h-32 resize-y rounded-xl bg-slate-50 font-medium leading-relaxed focus:border-rose-500 focus:ring-rose-500/10"
                    rows={4}
                    placeholder="Explique o motivo para o tutor..."
                  />
                </div>
              </div>
              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/80 p-4 sm:flex-row sm:justify-end sm:p-5">
                <button onClick={() => setCancelingAppointment(null)} className="btn-secondary rounded-xl">Voltar</button>
                <button onClick={cancelAppointment} disabled={submitting} className="rounded-xl bg-rose-600 px-5 py-2.5 font-bold text-white shadow-lg shadow-rose-600/20 transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {submitting ? 'Cancelando...' : 'Confirmar Cancelamento'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : appointments.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px]">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-400">Paciente</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-400">Especialista</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-400">Data / Hora</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-400">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-400">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {appointments.map((appointment) => (
                    <tr key={appointment.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                            <PawPrint className="h-5 w-5" />
                          </div>
                          <span className="font-semibold text-gray-700">{appointment.animal?.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-800">{appointment.doctor?.user?.name}</span>
                          <span className="text-[11px] font-bold uppercase text-gray-400">{appointment.doctor?.specialty}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Clock className="h-4 w-4 text-gray-300" />
                          {new Date(appointment.appointment_datetime).toLocaleString('pt-BR')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${statusColors[appointment.status]}`}>
                          {appointment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <AppointmentActions appointment={appointment} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-gray-100 md:hidden">
              {appointments.map((appointment) => (
                <div key={appointment.id} className="p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-800">{appointment.animal?.name}</p>
                      <p className="truncate text-sm text-gray-500">Dr(a). {appointment.doctor?.user?.name}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${statusColors[appointment.status]}`}>
                      {appointment.status}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p className="flex items-center gap-2"><Calendar className="h-4 w-4 text-gray-400" /> {new Date(appointment.appointment_datetime).toLocaleString('pt-BR')}</p>
                    <p className="flex items-center gap-2"><Stethoscope className="h-4 w-4 text-gray-400" /> {appointment.doctor?.specialty}</p>
                  </div>
                  <div className="mt-4">
                    <AppointmentActions appointment={appointment} />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="bg-gray-50/30 py-20 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
              <Search className="h-8 w-8 text-gray-200" />
            </div>
            <p className="font-medium text-gray-400">Nenhum agendamento encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
