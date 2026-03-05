import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { Campaign } from '../types';
import { formatRelativeTime } from '../services/utils';
import { ArrowLeft, Check, CheckCheck, Clock, AlertTriangle, XCircle, Loader2, Users, MessageSquare, Eye, Search, Filter } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface CampaignMessageWithRecipient {
  id: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  phone_number: string;
  personalized_message: string;
  recipients: {
    name: string;
    phone_number: string;
  } | null;
}

const CampaignDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, dir } = useLanguage();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [messages, setMessages] = useState<CampaignMessageWithRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch Initial Data
  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      
      const { data: campData, error: campError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .single();
        
      if (campError) {
        console.error('Error fetching campaign:', campError);
      }
      
      const { data: msgData, error: msgError } = await supabase
        .from('campaign_messages')
        .select(`
          id,
          status,
          sent_at,
          delivered_at,
          read_at,
          phone_number,
          personalized_message,
          recipients!inner(name, phone_number)
        `)
        .eq('campaign_id', id)
        .order('sent_at', { ascending: false, nullsFirst: false });
        
      if (msgError) {
        console.error('Error fetching messages:', msgError);
      }

      setCampaign(campData);
      setMessages(msgData || []);
      setLoading(false);
    };

    fetchData();
  }, [id]);

  // Polling for real-time stats
  useEffect(() => {
    if (!id) return;
    
    const pollInterval = setInterval(async () => {
      const { data } = await supabase
        .from('campaigns')
        .select('sent_count, delivered_count, read_count, failed_count, status')
        .eq('id', id)
        .single();
        
      if (data) {
        setCampaign(prev => prev ? { ...prev, ...data } : null);
      }
    }, 3000);
    
    return () => clearInterval(pollInterval);
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
          <p className="font-medium">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center p-8">
        <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <p className="text-red-600 font-semibold">{t('campaignDetail.notFound')}</p>
        <button
          onClick={() => navigate('/campaigns')}
          className="mt-4 text-primary-600 hover:underline font-medium"
        >
          {t('campaignDetail.backDashboard')}
        </button>
      </div>
    );
  }

  const progressPercentage = campaign?.total_recipients > 0 
    ? Math.round(((campaign.sent_count || 0) / campaign.total_recipients) * 100)
    : 0;

  // Filter messages
  const filteredMessages = messages.filter(msg => {
    const matchesSearch = 
      (msg.recipients?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (msg.phone_number || '').includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || msg.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { bg: string; text: string; icon: any; label: string }> = {
      pending: { bg: 'bg-gray-100', text: 'text-gray-700', icon: Clock, label: t('campaignDetail.stats.pending') },
      sent: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Check, label: t('campaignDetail.stats.sent') },
      delivered: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCheck, label: t('campaignDetail.stats.delivered') },
      read: { bg: 'bg-teal-100', text: 'text-teal-700', icon: Eye, label: t('campaignDetail.stats.read') },
      failed: { bg: 'bg-red-100', text: 'text-red-700', icon: AlertTriangle, label: t('campaignDetail.stats.failed') },
    };
    return configs[status] || configs.pending;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back Button */}
      <button
        onClick={() => navigate('/campaigns')}
        className="flex items-center text-gray-500 hover:text-gray-900 font-medium transition-colors"
      >
        {dir === 'rtl' ? <ArrowLeft size={20} className="ms-2 rotate-180" /> : <ArrowLeft size={20} className="me-2" />}
        {t('campaignDetail.backDashboard')}
      </button>

      {/* Header Card */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{campaign.name}</h1>
            <p className="text-gray-500 flex items-center gap-2 text-sm sm:text-base">
              <Clock size={16} /> {t('campaignDetail.startedOn')} {new Date(campaign.created_at).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center space-x-3 rtl:space-x-reverse w-full md:w-auto">
            <span className={`px-4 py-2 rounded-xl text-sm font-semibold tracking-wide uppercase ${
              campaign.status === 'running' ? 'bg-green-100 text-green-700' :
              campaign.status === 'completed' ? 'bg-blue-100 text-blue-700' :
              campaign.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {campaign.status}
            </span>
          </div>
        </div>
      </div>

      {/* Premium Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Total Recipients */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-500/20">
          <div className="absolute top-0 end-0 w-32 h-32 bg-white opacity-10 rounded-full -me-16 -mt-16"></div>
          <div className="relative">
            <Users className="opacity-80 mb-3" size={28} />
            <div className="text-3xl sm:text-4xl font-bold mb-1">{campaign.total_recipients}</div>
            <div className="text-sm opacity-90">{t('campaignNew.step5.recipients')}</div>
          </div>
        </div>

        {/* Sent */}
        <div className="relative overflow-hidden bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg shadow-green-500/20">
          <div className="absolute top-0 end-0 w-32 h-32 bg-white opacity-10 rounded-full -me-16 -mt-16"></div>
          <div className="relative">
            <Check className="opacity-80 mb-3" size={28} />
            <div className="text-3xl sm:text-4xl font-bold mb-1">{campaign.sent_count}</div>
            <div className="text-sm opacity-90">{t('campaignDetail.stats.sent')}</div>
            <div className="text-xs opacity-75 mt-2 font-mono">
              {progressPercentage}%
            </div>
          </div>
        </div>

        {/* Delivered */}
        <div className="relative overflow-hidden bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg shadow-teal-500/20">
          <div className="absolute top-0 end-0 w-32 h-32 bg-white opacity-10 rounded-full -me-16 -mt-16"></div>
          <div className="relative">
            <CheckCheck className="opacity-80 mb-3" size={28} />
            <div className="text-3xl sm:text-4xl font-bold mb-1">{campaign.delivered_count}</div>
            <div className="text-sm opacity-90">{t('campaignDetail.stats.delivered')}</div>
            <div className="text-xs opacity-75 mt-2 font-mono">
              {campaign.sent_count > 0 ? Math.round((campaign.delivered_count / campaign.sent_count) * 100) : 0}% rate
            </div>
          </div>
        </div>

        {/* Read */}
        <div className="relative overflow-hidden bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg shadow-purple-500/20">
          <div className="absolute top-0 end-0 w-32 h-32 bg-white opacity-10 rounded-full -me-16 -mt-16"></div>
          <div className="relative">
            <Eye className="opacity-80 mb-3" size={28} />
            <div className="text-3xl sm:text-4xl font-bold mb-1">{campaign.read_count}</div>
            <div className="text-sm opacity-90">{t('campaignDetail.stats.read')}</div>
            <div className="text-xs opacity-75 mt-2 font-mono">
              {campaign.sent_count > 0 ? Math.round((campaign.read_count / campaign.sent_count) * 100) : 0}% rate
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex justify-between text-sm mb-3 font-semibold">
          <span className="text-gray-700">{t('campaignDetail.progressTitle')}</span>
          <span className="text-primary-600 font-mono">{progressPercentage}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden shadow-inner" dir="ltr">
          <div 
            className="bg-gradient-to-r from-primary-500 to-primary-600 h-full transition-all duration-1000 ease-out relative"
            style={{ width: `${progressPercentage}%` }}
          >
            <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* Recipients Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{t('campaignNew.step5.recipients')}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {filteredMessages.length} / {messages.length}
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              {/* Search */}
              <div className="relative w-full sm:w-auto">
                <Search size={18} className="absolute top-1/2 -translate-y-1/2 text-gray-400 ms-3" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="ps-10 pe-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none w-full"
                />
              </div>
              
              {/* Status Filter */}
              <div className="relative w-full sm:w-auto">
                <Filter size={18} className="absolute top-1/2 -translate-y-1/2 text-gray-400 ms-3" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="ps-10 pe-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none appearance-none bg-white w-full"
                >
                  <option value="all">{t('campaignsList.filters.all')}</option>
                  <option value="pending">{t('campaignDetail.stats.pending')}</option>
                  <option value="sent">{t('campaignDetail.stats.sent')}</option>
                  <option value="delivered">{t('campaignDetail.stats.delivered')}</option>
                  <option value="read">{t('campaignDetail.stats.read')}</option>
                  <option value="failed">{t('campaignDetail.stats.failed')}</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-start text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  {t('campaignDetail.table.recipient')}
                </th>
                <th className="px-6 py-4 text-start text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  {t('campaignDetail.table.phone')}
                </th>
                <th className="px-6 py-4 text-start text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  {t('campaignDetail.table.status')}
                </th>
                <th className="px-6 py-4 text-end text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  {t('campaignDetail.table.lastUpdate')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredMessages.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">
                      {messages.length === 0 ? t('campaignDetail.noMessages') : 'No recipients match filter'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredMessages.map((msg) => {
                  const config = getStatusConfig(msg.status);
                  const Icon = config.icon;
                  
                  return (
                    <tr key={msg.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">
                          {msg.recipients?.name || 'Unknown'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm text-gray-600" dir="ltr">
                          {msg.phone_number || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
                          <Icon size={14} className="me-1.5" />
                          {config.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-end text-sm text-gray-500 font-mono">
                        {msg.sent_at ? formatRelativeTime(msg.sent_at) : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CampaignDetail;