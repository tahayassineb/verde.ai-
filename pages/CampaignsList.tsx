import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { supabase } from '../services/supabaseClient';
import { Campaign } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { Plus, Clock, Send, Loader2 } from 'lucide-react';

const CampaignsList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, dir } = useLanguage();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchCampaigns();
  }, [user]);

  const fetchCampaigns = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('campaigns')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setCampaigns(data || []);
    setLoading(false);
  };

  const filteredCampaigns = campaigns.filter(c => {
    if (filter === 'all') return true;
    if (filter === 'running') return c.status === 'running' || c.status === 'processing';
    if (filter === 'completed') return c.status === 'completed';
    if (filter === 'draft') return c.status === 'draft' || c.status === 'paused' || c.status === 'failed';
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'processing': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'completed': return 'bg-green-100 text-green-700 border-green-200';
      case 'failed': return 'bg-red-100 text-red-700 border-red-200';
      case 'paused': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">{t('campaignsList.title')}</h1>
          <p className="text-gray-500 mt-1">{t('campaignsList.subtitle')}</p>
        </div>
        <button
          onClick={() => navigate('/campaigns/new')}
          className="w-full sm:w-auto bg-gradient-to-r from-primary-600 to-primary-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-primary-500/30 hover:shadow-primary-500/40 transition-all active:scale-95 flex items-center justify-center gap-2 rtl:space-x-reverse"
        >
          <Plus size={20} />
          {t('dashboard.newCampaign')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex space-x-2 rtl:space-x-reverse border-b border-gray-200 pb-2 overflow-x-auto scrollbar-hide">
        {['all', 'running', 'completed', 'draft'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              filter === f ? 'bg-primary-50 text-primary-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {t(`campaignsList.filters.${f}`)}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" size={32} /></div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
           <Send className="w-16 h-16 text-gray-200 mx-auto mb-4" />
           <p className="text-gray-500 text-lg">{t('campaignsList.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredCampaigns.map(campaign => {
             const progress = campaign.total_recipients > 0 ? Math.round((campaign.sent_count / campaign.total_recipients) * 100) : 0;
             return (
               <div key={campaign.id} onClick={() => navigate(`/campaigns/${campaign.id}`)} className="group bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer relative overflow-hidden">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center space-x-3 rtl:space-x-reverse">
                        <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center text-primary-600 font-bold shrink-0">
                            {campaign.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 group-hover:text-primary-700 transition-colors line-clamp-1">{campaign.name}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium uppercase tracking-wide ${getStatusColor(campaign.status)}`}>
                                {campaign.status}
                            </span>
                        </div>
                    </div>
                  </div>
                  
                  <div className="mb-6">
                    <div className="flex justify-between text-xs text-gray-500 mb-1.5 font-medium">
                        <span>{t('campaignsList.progress')}</span>
                        <span dir="ltr">{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden" dir="ltr">
                        <div className="bg-primary-500 h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-6 text-center">
                     <div className="bg-gray-50 rounded-lg p-2">
                        <div className="text-xs text-gray-400 font-bold uppercase truncate">{t('campaignDetail.stats.sent')}</div>
                        <div className="font-bold text-gray-800">{campaign.sent_count}</div>
                     </div>
                     <div className="bg-green-50 rounded-lg p-2">
                        <div className="text-xs text-green-600 font-bold uppercase truncate">{t('campaignDetail.stats.delivered')}</div>
                        <div className="font-bold text-green-800">{campaign.delivered_count}</div>
                     </div>
                     <div className="bg-blue-50 rounded-lg p-2">
                        <div className="text-xs text-blue-600 font-bold uppercase truncate">{t('campaignDetail.stats.read')}</div>
                        <div className="font-bold text-blue-800">{campaign.read_count}</div>
                     </div>
                     <div className="bg-red-50 rounded-lg p-2">
                        <div className="text-xs text-red-600 font-bold uppercase truncate">{t('campaignDetail.stats.failed')}</div>
                        <div className="font-bold text-red-800">{campaign.failed_count}</div>
                     </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-50 text-xs text-gray-400 font-medium">
                     <div className="flex items-center rtl:space-x-reverse space-x-1">
                        <Clock size={14} />
                        <span>{new Date(campaign.created_at).toLocaleDateString()}</span>
                     </div>
                     <span className="text-primary-600 group-hover:underline">{t('campaignsList.viewDetails')}</span>
                  </div>
               </div>
             );
          })}
        </div>
      )}
    </div>
  );
};

export default CampaignsList;