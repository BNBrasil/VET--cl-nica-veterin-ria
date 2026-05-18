import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { 
  Home, 
  Calendar, 
  ClipboardList, 
  Syringe, 
  TestTube, 
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  PawPrint
} from 'lucide-react';
import { useState } from 'react';
import { hasRole } from '../stores/authStore';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard', roles: ['PACIENTE', 'RECEPCIONISTA', 'MEDICO', 'ADMIN'] },
    { path: '/animals', icon: PawPrint, label: 'Animais', roles: ['PACIENTE', 'RECEPCIONISTA', 'MEDICO', 'ADMIN'] },
    { path: '/appointments', icon: Calendar, label: 'Agendamentos', roles: ['PACIENTE', 'RECEPCIONISTA', 'MEDICO', 'ADMIN'] },
    { path: '/queue', icon: ClipboardList, label: 'Fila de Atendimento', roles: ['RECEPCIONISTA', 'ADMIN'] },
    { path: '/prescriptions', icon: FileText, label: 'Receitas', roles: ['PACIENTE', 'MEDICO', 'ADMIN'] },
    { path: '/vaccines', icon: Syringe, label: 'Vacinas', roles: ['PACIENTE', 'RECEPCIONISTA', 'MEDICO', 'ADMIN'] },
    { path: '/exams', icon: TestTube, label: 'Exames', roles: ['PACIENTE', 'RECEPCIONISTA', 'MEDICO', 'ADMIN'] },
    { path: '/admin', icon: Settings, label: 'Administração', roles: ['ADMIN'] },
  ];

  const visibleNavItems = navItems.filter(item => user && hasRole(user, item.roles as any));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 fixed top-0 left-0 right-0 z-50">
        <div className="px-4 lg:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
              >
                {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
              <Link to="/" className="flex items-center gap-2">
                <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
                  <PawPrint className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-800 hidden sm:block">VET</span>
              </Link>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:block text-right">
                <p className="text-sm font-medium text-gray-800">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <aside className={`fixed top-16 left-0 w-64 h-screen bg-white border-r border-gray-200 overflow-y-auto transition-transform duration-300 z-40 
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <nav className="p-4 space-y-1">
          {visibleNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200
                ${isActive(item.path) 
                  ? 'bg-primary-50 text-primary-700 border-l-4 border-primary-600' 
                  : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <main className="pt-16 lg:pl-64">
        <div className="p-6">
          <Outlet />
        </div>
      </main>

      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}