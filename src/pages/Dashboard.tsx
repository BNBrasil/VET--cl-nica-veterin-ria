import { useAuthStore } from '../stores/authStore';
import { motion } from 'framer-motion';
import { 
  PawPrint, 
  Calendar, 
  Clock, 
  FileText, 
  Syringe, 
  TestTube,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function Dashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({
    animals: 0,
    appointments: 0,
    pendingExams: 0,
    upcomingVaccines: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [animalsRes, appointmentsRes] = await Promise.all([
          api.get('/animals'),
          api.get('/appointments'),
        ]);
        setStats({
          animals: animalsRes.data.animals?.length || 0,
          appointments: appointmentsRes.data.appointments?.length || 0,
          pendingExams: 0,
          upcomingVaccines: 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };
    fetchStats();
  }, []);

  const roleCards = {
    PACIENTE: [
      { title: 'Meus Animais', value: stats.animals, icon: PawPrint, color: 'bg-blue-500' },
      { title: 'Agendamentos', value: stats.appointments, icon: Calendar, color: 'bg-green-500' },
    ],
    RECEPCIONISTA: [
      { title: 'Total Animais', value: stats.animals, icon: PawPrint, color: 'bg-blue-500' },
      { title: 'Consultas Hoje', value: stats.appointments, icon: Calendar, color: 'bg-green-500' },
      { title: 'Pendentes', value: stats.pendingExams, icon: Clock, color: 'bg-yellow-500' },
    ],
    MEDICO: [
      { title: 'Consultas Hoje', value: stats.appointments, icon: Calendar, color: 'bg-green-500' },
      { title: 'Exames Pendentes', value: stats.pendingExams, icon: TestTube, color: 'bg-purple-500' },
      { title: 'Próximas Vacinas', value: stats.upcomingVaccines, icon: Syringe, color: 'bg-orange-500' },
    ],
    ADMIN: [
      { title: 'Total Animais', value: stats.animals, icon: PawPrint, color: 'bg-blue-500' },
      { title: 'Agendamentos', value: stats.appointments, icon: Calendar, color: 'bg-green-500' },
      { title: 'Exames Pendentes', value: stats.pendingExams, icon: TestTube, color: 'bg-purple-500' },
      { title: 'Receitas Emitidas', value: 0, icon: FileText, color: 'bg-pink-500' },
    ],
  };

  const cards = user ? roleCards[user.role] || [] : [];

  const roleMessages = {
    PACIENTE: 'Gerencie seus pets e agendamentos',
    RECEPCIONISTA: 'Controle a fila e agendamentos da clínica',
    MEDICO: 'Acompanhe suas consultas e prontuários',
    ADMIN: 'Visão geral da clínica',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-500 mt-1">{roleMessages[user?.role || 'PACIENTE']}</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-primary-50 rounded-lg">
          <TrendingUp className="w-5 h-5 text-primary-600" />
          <span className="text-sm font-medium text-primary-700">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.title}</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{card.value}</p>
              </div>
              <div className={`w-12 h-12 ${card.color} rounded-xl flex items-center justify-center`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Próximos Agendamentos</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-800">Nenhum agendamento próximo</p>
                <p className="text-sm text-gray-500">Agende uma consulta para seu pet</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Atenções</h3>
          <div className="flex items-center gap-4 p-4 bg-yellow-50 rounded-lg">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <p className="text-sm text-yellow-800">Sistema em desenvolvimento. Algumas funcionalidades estão em construção.</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}