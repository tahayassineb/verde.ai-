import React, { useEffect, useState } from 'react';
import { useAuth } from '../App';
import { supabase } from '../services/supabaseClient';
import { Campaign, Session } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Send, Users, Activity, MessageSquare, ArrowUpRight, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SESSION_TABLE } from '../constants';
import { useLanguage } from '../i18n/LanguageContext';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, dir } = useLanguage();
  const [stats, setStats] = useState({
    totalCampaigns: 0,
    activeSessions: 0,
    sentMessages: 0,
    responseRate: 0,
  });
  const [recentCampaigns, setRecentCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);

      // Fetch Campaigns
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch Sessions count from correct table
      const { count: sessionCount } = await supabase
        .from(SESSION_TABLE)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'connected');

      // Calculate simple stats based on loaded campaigns (In a real app, use aggregate SQL queries)
      const totalSent = campaigns?.reduce((acc, curr) => acc + (curr.sent_count || 0), 0) || 0;
      const totalDelivered = campaigns?.reduce((acc, curr) => acc + (curr.delivered_count || 0), 0) || 0;
      // Mock response rate logic
      const rate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;

      setStats({
        totalCampaigns: campaigns?.length || 0, // Should be total count, simplistic here
        activeSessions: sessionCount || 0,
        sentMessages: totalSent,
        responseRate: rate
      });

      setRecentCampaigns(campaigns || []);
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const StatCard = ({ title, value, icon: Icon, gradient }: any) => (
    <div className={`relative overflow-hidden rounded-2xl p-6 text-white shadow-lg shadow-gray-200 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${gradient}`}>
      {/* Decorative Circles */}
      <div className="absolute top-0 end-0 -me-4 -mt-4 w-24 h-24 rounded-full bg-white/10 blur-xl"></div>
      <div className="absolute bottom-0 start-0 -ms-4 -mb-4 w-20 h-20 rounded-full bg-black/5 blur-lg"></div>
      
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <p className="text-white/80 text-sm font-medium mb-1 tracking-wide">{title}</p>
          <h3 className="text-2xl sm:text-3xl font-bold">{value}</h3>
        </div>
        <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm shadow-inner">
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">{t('dashboard.hello')}, <span dir="ltr">{user?.full_name || user?.phone_number}</span> 👋</h1>
          <p className="text-gray-500 mt-1 text-base sm:text-lg">{t('dashboard.subtitle')}</p>
        </div>
        <button 
          onClick={() => navigate('/campaigns/new')}
          className="w-full sm:w-auto bg-gradient-to-r from-primary-600 to-primary-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-primary-500/30 hover:shadow-primary-500/40 hover:from-primary-700 hover:to-primary-800 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
        >
          <Send size={18} />
          {t('dashboard.newCampaign')}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard 
          title={t('dashboard.totalCampaigns')}
          value={stats.totalCampaigns} 
          icon={Send} 
          gradient="bg-gradient-to-br from-blue-500 to-blue-600" 
        />
        <StatCard 
          title={t('dashboard.activeSessions')}
          value={stats.activeSessions} 
          icon={Activity} 
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-600" 
        />
        <StatCard 
          title={t('dashboard.sentMessages')}
          value={stats.sentMessages} 
          icon={MessageSquare} 
          gradient="bg-gradient-to-br from-violet-500 to-violet-600" 
        />
        <StatCard 
          title={t('dashboard.deliveryRate')}
          value={`${stats.responseRate}%`} 
          icon={Users} 
          gradient="bg-gradient-to-br from-orange-500 to-orange-600" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Recent Campaigns List */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
            <h3 className="text-lg sm:text-xl font-bold text-gray-800">{t('dashboard.recentCampaigns')}</h3>
            <div className="flex items-center gap-2 self-end sm:self-auto">
                <button onClick={() => navigate('/campaigns/new')} className="bg-primary-50 text-primary-700 p-2 rounded-lg hover:bg-primary-100 transition-colors" title={t('dashboard.newCampaign')}>
                  <Plus size={18} />
                </button>
                <button onClick={() => navigate('/campaigns')} className="text-primary-600 text-sm hover:text-primary-700 font-semibold flex items-center gap-1 hover:gap-2 transition-all">
                  {t('common.viewAll')} {dir === 'rtl' ? <ArrowUpRight size={16} className="rotate-90" /> : <ArrowUpRight size={16} />}
                </button>
            </div>
          </div>
          
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-12 text-gray-400">{t('common.loading')}</div>
            ) : recentCampaigns.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Send className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">{t('dashboard.noCampaigns')}</p>
                <button onClick={() => navigate('/campaigns/new')} className="mt-4 text-primary-600 font-medium hover:underline">{t('dashboard.createFirst')}</button>
              </div>
            ) : (
              recentCampaigns.map((camp) => (
                <div 
                  key={camp.id} 
                  onClick={() => navigate(`/campaigns/${camp.id}`)}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white border border-gray-100 rounded-xl hover:border-primary-100 hover:shadow-lg hover:shadow-primary-500/5 hover:scale-[1.01] transition-all duration-200 cursor-pointer relative overflow-hidden gap-4"
                >
                  <div className="absolute start-0 top-0 bottom-0 w-1 bg-primary-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex items-center space-x-5 rtl:space-x-reverse">
                    <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition-colors duration-200 shrink-0">
                      <Send size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 group-hover:text-primary-700 transition-colors line-clamp-1">{camp.name}</h4>
                      <p className="text-xs text-gray-500 mt-1">{t('dashboard.createdOn')} {new Date(camp.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end sm:space-x-6 rtl:space-x-reverse w-full sm:w-auto">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide ${
                      camp.status === 'completed' ? 'bg-green-100 text-green-700' :
                      camp.status === 'processing' || camp.status === 'running' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {camp.status.toUpperCase()}
                    </span>
                    <div className="flex items-center gap-4">
                      <div className="text-end block sm:block">
                        <div className="text-sm font-bold text-gray-900">{camp.sent_count}<span className="text-gray-400 text-xs font-normal"> / {camp.total_recipients}</span></div>
                        <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">{t('dashboard.sent')}</div>
                      </div>
                      <ArrowUpRight size={18} className="text-gray-300 group-hover:text-primary-600 transition-colors" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Mini Chart Area */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 flex flex-col">
          <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-6">{t('dashboard.performanceOverview')}</h3>
          <div className="flex-1 min-h-[250px] relative" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={recentCampaigns.slice(0, 3).reverse()} barSize={20}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{fontSize: 10, fill: '#9ca3af'}} interval={0} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}} />
                <Bar dataKey="sent_count" fill="#059669" radius={[4, 4, 0, 0]} name={t('dashboard.sentCount')} />
                <Bar dataKey="read_count" fill="#34d399" radius={[4, 4, 0, 0]} name={t('dashboard.readCount')} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-8 pt-6 border-t border-gray-100">
             <button onClick={() => navigate('/sessions')} className="w-full py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-semibold hover:bg-white hover:border-gray-300 hover:shadow-md transition-all duration-200 active:scale-95 text-sm">
                {t('dashboard.manageSessions')}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;