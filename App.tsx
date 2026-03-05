import React, { createContext, useContext, useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LucideLayoutDashboard, MessageSquare, Send, LogOut, Menu, X, Globe } from 'lucide-react';
import { User } from './types';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Sessions from './pages/Sessions';
import CampaignsList from './pages/CampaignsList';
import CampaignNew from './pages/CampaignNew';
import CampaignDetail from './pages/CampaignDetail';
import { supabase } from './services/supabaseClient';
import { useLanguage } from './i18n/LanguageContext';

// Auth Context
interface AuthContextType {
  user: User | null;
  login: (user: User, session?: any) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>(null!);

export const useAuth = () => useContext(AuthContext);

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      // Restore User
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }

      // Restore Supabase Session
      const storedSession = localStorage.getItem('sb_session');
      if (storedSession) {
        try {
          const session = JSON.parse(storedSession);
          await supabase.auth.setSession(session);
        } catch (e) {
          console.error("Failed to restore Supabase session", e);
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (userData: User, sessionData?: any) => {
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    
    if (sessionData) {
      localStorage.setItem('sb_session', JSON.stringify(sessionData));
      await supabase.auth.setSession(sessionData);
    }
  };

  const logout = async () => {
    localStorage.removeItem('user');
    localStorage.removeItem('subscription');
    localStorage.removeItem('sb_session');
    await supabase.auth.signOut();
    setUser(null);
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-primary-600">Chargement...</div>;

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// Layout Component
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const { t, language, setLanguage, dir } = useLanguage();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { label: t('common.dashboard'), path: '/dashboard', icon: <LucideLayoutDashboard size={20} /> },
    { label: t('common.campaigns'), path: '/campaigns', icon: <Send size={20} /> }, 
    { label: t('common.sessions'), path: '/sessions', icon: <MessageSquare size={20} /> },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans" dir={dir}>
      {/* Mobile Header */}
      <div className="md:hidden bg-white p-4 flex justify-between items-center shadow-sm z-30 relative">
        <img 
          src="https://nlfixnhoufntbbcccnwr.supabase.co/storage/v1/object/public/campaigns/b131c9ef-add4-4bec-964f-9b6c56144392/hf_20260123_210131_ee457ba5-c6a1-4011-82b4-437d7427d82b-removebg-preview.png" 
          alt="Verde.ai" 
          className="h-8 w-auto object-contain"
        />
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-gray-600 p-2 rounded-lg hover:bg-gray-100">
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`fixed md:relative z-20 w-64 bg-white border-e border-gray-200 h-full md:h-screen transition-transform duration-300 ease-in-out flex flex-col ${isMobileMenuOpen ? 'translate-x-0' : (dir === 'rtl' ? 'translate-x-full md:translate-x-0' : '-translate-x-full md:translate-x-0')}`}>
        <div className="p-4 pt-24 md:p-8">
          <img 
            src="https://nlfixnhoufntbbcccnwr.supabase.co/storage/v1/object/public/campaigns/b131c9ef-add4-4bec-964f-9b6c56144392/hf_20260123_210131_ee457ba5-c6a1-4011-82b4-437d7427d82b-removebg-preview.png" 
            alt="Verde.ai" 
            className="hidden md:block h-12 w-auto mb-10 object-contain mx-auto md:mx-0"
          />
          <div className="space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 rtl:space-x-reverse px-4 py-3.5 rounded-xl transition-all duration-200 group ${
                    isActive
                      ? 'bg-primary-50 text-primary-700 font-semibold border-s-4 border-primary-600 shadow-sm'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-primary-600 font-medium'
                  }`}
                >
                  <span className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-auto p-6 border-t border-gray-100">
          {/* Language Selector */}
          <div className="mb-4">
             <div className="flex items-center space-x-2 rtl:space-x-reverse bg-gray-50 p-2 rounded-lg border border-gray-200">
                 <Globe size={16} className="text-gray-400 ms-1" />
                 <select 
                    value={language} 
                    onChange={(e) => setLanguage(e.target.value as any)}
                    className="bg-transparent border-none text-sm font-medium text-gray-700 outline-none w-full"
                 >
                     <option value="fr">Français</option>
                     <option value="en">English</option>
                     <option value="ar">العربية</option>
                 </select>
             </div>
          </div>

          <div className="flex items-center space-x-3 rtl:space-x-reverse mb-6 bg-gray-50 p-3 rounded-xl border border-gray-100">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 text-primary-700 flex items-center justify-center font-bold text-sm shadow-inner shrink-0">
              {user?.phone_number?.slice(-2) || 'WA'}
            </div>
            <div className="text-sm font-medium text-gray-700 truncate flex-1">
              <div className="text-xs text-gray-400">{t('common.loginAs')}</div>
              <div className="font-semibold text-gray-800 truncate" dir="ltr">{user?.full_name || user?.phone_number}</div>
            </div>
          </div>
          <button 
            onClick={handleLogout} 
            className="w-full flex items-center justify-center space-x-2 rtl:space-x-reverse px-4 py-3 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl transition-all duration-200 font-medium border border-transparent hover:border-red-100"
          >
            <LogOut size={18} />
            <span>{t('common.logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto h-[calc(100vh-64px)] md:h-screen p-4 md:p-8 bg-gray-50/50">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-10 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/sessions"
            element={
              <ProtectedRoute>
                <Layout>
                  <Sessions />
                </Layout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/campaigns"
            element={
              <ProtectedRoute>
                <Layout>
                  <CampaignsList />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/campaigns/new"
            element={
              <ProtectedRoute>
                <Layout>
                  <CampaignNew />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/campaigns/:id"
            element={
              <ProtectedRoute>
                <Layout>
                  <CampaignDetail />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
};

export default App;