import React, { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { useAuth } from '../App';
import { supabase } from '../services/supabaseClient';
import { N8N_WEBHOOKS, SESSION_TABLE } from '../constants';
import { Session } from '../types';
import { validateMoroccoPhone } from '../services/utils';
import { Plus, Trash2, Smartphone, Loader2, RefreshCw, Wifi, WifiOff, ScanLine, X, Link as LinkIcon } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

const Sessions: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Reconnect State
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectQR, setReconnectQR] = useState<string | null>(null);
  
  // New Session Form State
  const [newSessionName, setNewSessionName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [error, setError] = useState('');
  
  // QR Timer & Regeneration State
  const [qrTimer, setQrTimer] = useState(40);
  const [regenerating, setRegenerating] = useState(false);

  const fetchSessions = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from(SESSION_TABLE)
      .select('*')
      .eq('user_id', user.id);
      
    if (error) console.error(error);
    setSessions(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchSessions();
  }, [user]);

  // QR Timer Logic
  useEffect(() => {
    let interval: any;
    if (qrCodeData && qrTimer > 0) {
      interval = setInterval(() => {
        setQrTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [qrCodeData, qrTimer]);

  useEffect(() => {
    if (!qrCodeData) {
      setQrTimer(40);
    }
  }, [qrCodeData]);

  // Realtime Subscription for Creation
  useEffect(() => {
    if (!currentSessionId) return;

    const handleSuccess = () => {
      setIsModalOpen(false);
      setQrCodeData(null);
      setCurrentSessionId(null);
      fetchSessions();
      alert(t('common.success'));
    };

    const channel = supabase
      .channel(`session:${currentSessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: SESSION_TABLE,
        filter: `id=eq.${currentSessionId}`
      }, (payload) => {
        const updatedSession = payload.new as Session;
        if (updatedSession.qr_code) setQrCodeData(updatedSession.qr_code);
        if (updatedSession.status === 'connected') handleSuccess();
      })
      .subscribe();

    const pollInterval = setInterval(async () => {
      const { data } = await supabase
        .from(SESSION_TABLE)
        .select('*')
        .eq('id', currentSessionId)
        .single();
        
      if (data) {
        if (data.qr_code) setQrCodeData(data.qr_code);
        if (data.status === 'connected') handleSuccess();
      }
    }, 2000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [currentSessionId]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setQrCodeData(null);
    setCurrentSessionId(null);
    setError('');

    const validation = validateMoroccoPhone(newPhone);
    if (!validation.valid) {
      setError(validation.error || 'Numéro invalide');
      setCreating(false);
      return;
    }
    const normalizedPhone = validation.normalized || newPhone;

    try {
      const response = await fetch(N8N_WEBHOOKS.createSession, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.id,
          session_name: newSessionName,
          phone_number: normalizedPhone
        })
      });
      
      const text = await response.text();
      let data = text ? JSON.parse(text) : {};

      if (!response.ok || (data.success === false && !data.session)) {
        if (response.status === 403) {
          setError(`${data.message || 'Limite atteinte'}.`);
        } else {
          setError(data.message || t('common.error'));
        }
        setCreating(false);
        return;
      }
      
      const sessionId = data.session?.id || data.id || data.session_id;
      
      if (sessionId) {
        setCurrentSessionId(sessionId);
        const { data: freshSession } = await supabase
          .from(SESSION_TABLE)
          .select('*')
          .eq('id', sessionId)
          .single();
          
        if (freshSession) {
          if (freshSession.qr_code) setQrCodeData(freshSession.qr_code);
          if (freshSession.status === 'connected') {
            setIsModalOpen(false);
            setQrCodeData(null);
            setCurrentSessionId(null);
            fetchSessions();
            alert("Session déjà connectée !");
            setCreating(false);
            return;
          }
        }
      } else {
        setError("Erreur: ID de session non reçu.");
      }

    } catch (err: any) {
      setError(err.message || "Erreur de connexion serveur.");
    } finally {
      setCreating(false);
    }
  };

  const handleRegenerateQR = async () => {
    if (!currentSessionId) return;
    setRegenerating(true);
    try {
      const { data, error } = await supabase
        .from(SESSION_TABLE)
        .select('instance_id')
        .eq('id', currentSessionId)
        .single();

      if (error || !data || !data.instance_id) throw new Error(t('sessions.instanceMissing'));

      await fetch(N8N_WEBHOOKS.regenerateQR, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance_id: data.instance_id })
      });

      setQrCodeData(null);
      setQrTimer(40);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRegenerating(false);
    }
  };

  // Logic for Reconnection Modal (QR Code Display)
  useEffect(() => {
    let interval: any;
    if (reconnecting && reconnectQR) {
        // Just for visual effect if we wanted a timer, but here we just wait for connection
    }
  }, [reconnecting, reconnectQR]);

  const startReconnectMonitoring = (sessionId: string) => {
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes
    
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        // Do not close automatically, let user close or retry
        return;
      }

      const { data } = await supabase.from(SESSION_TABLE).select('status, qr_code').eq('id', sessionId).single();
      if (data) {
        if (data.qr_code && data.qr_code !== reconnectQR) {
            setReconnectQR(data.qr_code);
        }
        if (data.status === 'connected') {
           clearInterval(interval);
           setReconnecting(false);
           setReconnectQR(null);
           fetchSessions();
           // alert(t('common.success')); // Optional alert
        }
      }
    }, 2000);
    
    // Also subscribe to realtime updates
    const channel = supabase
      .channel(`reconnect:${sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: SESSION_TABLE,
        filter: `id=eq.${sessionId}`
      }, (payload) => {
        const updated = payload.new as Session;
        if (updated.qr_code) setReconnectQR(updated.qr_code);
        if (updated.status === 'connected') {
            supabase.removeChannel(channel);
            clearInterval(interval);
            setReconnecting(false);
            setReconnectQR(null);
            fetchSessions();
        }
      })
      .subscribe();
      
    // Cleanup function not strictly possible inside this handler scope easily without refs, 
    // but the component unmount will handle general cleanup.
  };

  const handleReconnect = async (session: Session) => {
    if (!session.instance_id) {
        alert(t('sessions.instanceMissing'));
        return;
    }
    
    setReconnecting(true);
    setReconnectQR(null);
    
    try {
        // 1. Trigger Webhook
        await fetch(N8N_WEBHOOKS.regenerateQR, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instance_id: session.instance_id })
        });
        
        // 2. Start monitoring for QR code update or status change
        startReconnectMonitoring(session.id);
        
    } catch (err) {
        setReconnecting(false);
        alert(t('sessions.reconnectError'));
    }
  };

  const handleDeleteSession = async (id: string) => {
    if(!confirm(t('sessions.deleteConfirm'))) return;
    await supabase.from(SESSION_TABLE).delete().eq('id', id);
    fetchSessions();
  };

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
           <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">{t('sessions.title')}</h1>
           <p className="text-gray-500 mt-1">{t('sessions.subtitle')}</p>
        </div>
        <div className="flex w-full sm:w-auto space-x-3 rtl:space-x-reverse">
          <button 
            onClick={fetchSessions}
            className="flex-1 sm:flex-none justify-center bg-white text-gray-600 border border-gray-200 shadow-sm px-4 py-3 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-95"
            title={t('common.refresh')}
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex-1 sm:flex-none bg-gradient-to-r from-primary-600 to-primary-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-primary-500/30 hover:shadow-primary-500/40 hover:from-primary-700 hover:to-primary-800 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            <span className="whitespace-nowrap">{t('sessions.addSession')}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-20 text-gray-400">
             <Loader2 className="animate-spin w-8 h-8" />
          </div>
        ) : sessions.length === 0 ? (
           <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
             <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Smartphone className="w-8 h-8 text-gray-400" />
             </div>
             <p className="text-gray-900 font-semibold text-lg">{t('sessions.noSessions')}</p>
             <p className="text-gray-500 mt-1">{t('sessions.connectAccount')}</p>
           </div>
        ) : (
          sessions.map(session => (
            <div 
                key={session.id} 
                className={`group bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden ${
                    session.status === 'connected' ? 'border-t-4 border-t-green-500' : 'border-t-4 border-t-red-500'
                }`}
            >
              <div className="flex items-center space-x-5 rtl:space-x-reverse mb-5">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${session.status === 'connected' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                  <Smartphone size={28} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-lg group-hover:text-primary-700 transition-colors">{session.session_name}</h3>
                  <p className="text-sm text-gray-500 font-mono tracking-tight" dir="ltr">{session.phone_number}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                <span className={`flex items-center space-x-2 rtl:space-x-reverse text-sm font-semibold px-3 py-1 rounded-full ${session.status === 'connected' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {session.status === 'connected' ? <Wifi size={14} /> : 
                   session.status === 'connecting' ? <RefreshCw size={14} className="animate-spin" /> : 
                   session.status === 'need_scan' ? <ScanLine size={14} /> : <WifiOff size={14} />}
                  <span>
                    {session.status === 'connected' ? t('sessions.connected') : 
                     session.status === 'need_scan' ? t('sessions.needScan') :
                     session.status === 'connecting' ? t('sessions.connecting') : t('sessions.disconnected')}
                  </span>
                </span>
                
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    {session.status !== 'connected' && (
                        <button 
                            onClick={() => handleReconnect(session)}
                            className="flex items-center gap-2 bg-orange-50 text-orange-700 hover:bg-orange-100 px-3 py-2 rounded-lg transition-colors border border-orange-100 font-medium text-sm"
                            title={t('sessions.reconnect')}
                        >
                            <LinkIcon size={16} />
                            <span className="hidden sm:inline">{t('sessions.reconnect')}</span>
                        </button>
                    )}
                    <button 
                      onClick={() => handleDeleteSession(session.id)}
                      className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                      title={t('common.delete')}
                    >
                      <Trash2 size={18} />
                    </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Main Modal for NEW Session */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-none sm:rounded-3xl w-full max-w-md h-full sm:h-auto p-6 sm:p-8 relative shadow-2xl scale-100 transition-all overflow-y-auto">
            <button 
              onClick={() => {
                setIsModalOpen(false);
                setQrCodeData(null);
                setCurrentSessionId(null);
                setError('');
                setCreating(false);
              }}
              className="absolute top-5 end-5 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors z-10"
            >
              <X size={24} />
            </button>
            
            <h2 className="text-2xl font-bold mb-8 text-gray-900 text-center mt-6 sm:mt-0">{t('sessions.modalTitle')}</h2>

            {error && (
               <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm flex items-start gap-2">
                 <div className="mt-0.5"><WifiOff size={16} /></div>
                 {error}
               </div>
            )}
            
            {!currentSessionId && !qrCodeData ? (
              <form onSubmit={handleCreateSession} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{t('sessions.sessionName')}</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Support Client 1"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-gray-900 focus:bg-white focus:ring-4 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all duration-200"
                    value={newSessionName}
                    onChange={(e) => setNewSessionName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{t('sessions.associatedNumber')}</label>
                  <input
                    type="tel"
                    required
                    placeholder="212 6XX XXX XXX"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-gray-900 focus:bg-white focus:ring-4 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all duration-200"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={creating}
                  className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 hover:from-primary-700 hover:to-primary-800 transition-all duration-200 active:scale-95 flex items-center justify-center mt-2"
                >
                   {creating ? <Loader2 className="animate-spin" /> : t('sessions.generateQR')}
                </button>
              </form>
            ) : (
              <div className="flex flex-col items-center min-h-[300px] justify-center text-center">
                {qrCodeData ? (
                  qrTimer > 0 ? (
                    <>
                      <div className="p-6 bg-white border border-gray-100 rounded-2xl shadow-xl mb-6">
                        <QRCode value={qrCodeData} size={220} className="w-full h-auto max-w-[220px]" />
                      </div>
                      <p className="text-sm text-gray-600 mb-2 font-medium">{t('sessions.scanInstruction')}</p>
                      <div className="flex items-center space-x-2 rtl:space-x-reverse text-primary-600 bg-primary-50 px-3 py-1 rounded-full animate-pulse">
                        <RefreshCw size={14} className="animate-spin" />
                        <span className="text-xs font-bold">{t('sessions.refreshingIn')} {qrTimer}s</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6 text-gray-400">
                        <ScanLine size={40} />
                      </div>
                      <p className="text-gray-900 font-bold text-lg mb-2">{t('sessions.qrExpired')}</p>
                      <p className="text-gray-500 text-sm mb-6 max-w-[200px]">{t('sessions.codeExpiredMsg')}</p>
                      <button 
                        onClick={handleRegenerateQR}
                        disabled={regenerating}
                        className="bg-primary-600 text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-primary-500/20 hover:bg-primary-700 transition-all active:scale-95 flex items-center space-x-2 rtl:space-x-reverse"
                      >
                        <RefreshCw size={18} className={regenerating ? 'animate-spin' : ''} />
                        <span>{regenerating ? '...' : t('sessions.regenerate')}</span>
                      </button>
                    </>
                  )
                ) : (
                  <div className="text-center py-8">
                     <div className="relative w-20 h-20 mx-auto mb-6">
                        <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                     </div>
                     <h3 className="text-xl font-bold text-gray-900 mb-2">{t('sessions.connecting')}</h3>
                     <p className="text-gray-500 text-sm">{t('sessions.preparing')}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reconnect Modal */}
      {reconnecting && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-none sm:rounded-3xl w-full max-w-md h-full sm:h-auto p-6 sm:p-8 relative flex flex-col items-center shadow-2xl overflow-y-auto justify-center">
            <button 
              onClick={() => {
                setReconnecting(false);
                setReconnectQR(null);
              }}
              className="absolute top-5 end-5 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
            >
              <X size={24} />
            </button>
            <h2 className="text-2xl font-bold mb-6 text-gray-900">{t('sessions.reconnectTitle')}</h2>
            
            {reconnectQR ? (
              <div className="animate-fade-in flex flex-col items-center w-full">
                <div className="p-6 bg-white border border-gray-100 rounded-2xl shadow-xl mb-6 w-full flex justify-center">
                   <QRCode value={reconnectQR} size={220} className="w-full h-auto max-w-[220px]" />
                </div>
                <p className="text-center text-gray-600 text-sm max-w-xs font-medium">
                  {t('sessions.scanInstruction')}
                </p>
              </div>
            ) : (
               <div className="flex flex-col items-center justify-center py-12">
                  <div className="relative w-16 h-16 mb-4">
                     <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
                     <div className="absolute inset-0 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <p className="text-gray-500 font-medium">{t('sessions.preparing')}</p>
                  <p className="text-xs text-gray-400 mt-2">Waiting for QR Code from server...</p>
               </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Sessions;