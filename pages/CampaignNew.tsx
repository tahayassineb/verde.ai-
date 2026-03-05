import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../App';
import { supabase } from '../services/supabaseClient';
import { N8N_WEBHOOKS, SESSION_TABLE } from '../constants';
import { Session, Recipient } from '../types';
import { useNavigate } from 'react-router-dom';
import { validateMoroccoPhone } from '../services/utils';
import { 
  ChevronRight, ChevronLeft, Upload, FileSpreadsheet, 
  Image as ImageIcon, Video, FileText, Mic, Sparkles, 
  AlertCircle, Trash2, Plus, RefreshCw, Check, ArrowLeft, 
  Clock, Users, Smartphone, Loader2, Calendar, XCircle, Send, CheckCheck
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

const CampaignNew: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, dir } = useLanguage();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [message, setMessage] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<string>('');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [timing, setTiming] = useState('now');
  const [scheduledTime, setScheduledTime] = useState('');
  const [minDelay, setMinDelay] = useState(30);
  const [maxDelay, setMaxDelay] = useState(120);
  const [selectedSessionId, setSelectedSessionId] = useState('');

  // Preview State
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (mediaFile) {
      const url = URL.createObjectURL(mediaFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [mediaFile]);

  const getSessions = async () => {
    if (user) {
      const { data, error } = await supabase
        .from(SESSION_TABLE)
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'connected');
      
      setSessions(data || []);
      if (data && data.length > 0 && !selectedSessionId) {
        setSelectedSessionId(data[0].id);
      }
    }
  };

  useEffect(() => {
    getSessions();
  }, [user]);

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      const parsedRecipients: Recipient[] = [];
      data.forEach((row: any) => {
        const rawPhone = row.phone || row.telephone || row.mobile || '';
        const validation = validateMoroccoPhone(rawPhone.toString());
        if (validation.valid && validation.normalized) {
          parsedRecipients.push({
            phone: validation.normalized,
            phone_number: validation.normalized,
            name: row.name || row.nom || 'Client',
            information: row.information || row.info || '',
          });
        }
      });
      setRecipients(parsedRecipients);
    };
    reader.readAsBinaryString(file);
  };

  const handleAddRecipient = () => {
    setRecipients([...recipients, { phone: '', phone_number: '', name: '', information: '' }]);
  };

  const handleDeleteRecipient = (index: number) => {
    setRecipients(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateRecipient = (index: number, field: keyof Recipient, value: string) => {
    setRecipients(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'phone') updated[index].phone_number = value;
      return updated;
    });
  };

  const launchCampaign = async () => {
    if (!user || !selectedSessionId) {
        alert(t('campaignNew.step5.noSessionMsg'));
        return;
    }

    const selectedSession = sessions.find(s => s.id === selectedSessionId);
    if (!selectedSession || selectedSession.status !== 'connected') {
      alert("Session non connectée ou invalide.");
      return;
    }

    setLoading(true);

    try {
      let mediaUrl = null;
      if (mediaFile) {
        const cleanName = mediaFile.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const fileName = `${user.id}/${Date.now()}_${cleanName}`;

        const { error: uploadError } = await supabase.storage
          .from('campaigns')
          .upload(fileName, mediaFile);
        
        if (uploadError) throw uploadError;
        
        const { data: publicUrlData } = supabase.storage.from('campaigns').getPublicUrl(fileName);
        mediaUrl = publicUrlData.publicUrl;
      }

      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          user_id: user.id,
          session_id: selectedSessionId,
          name,
          description,
          message_template: message,
          media_url: mediaUrl,
          media_type: mediaType || null,
          ai_enabled: aiEnabled,
          min_delay_seconds: minDelay,
          max_delay_seconds: maxDelay,
          total_recipients: recipients.length,
          status: 'processing',
          scheduled_at: timing === 'scheduled' ? new Date(scheduledTime).toISOString() : new Date().toISOString()
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      const recipientsData = recipients.map(r => ({
        campaign_id: campaign.id,
        phone_number: r.phone_number,
        name: r.name,
        information: r.information
      }));

      const { data: insertedRecipients, error: recipError } = await supabase.from('recipients').insert(recipientsData).select();
      if (recipError) throw recipError;

      if (insertedRecipients) {
        const messagesData = insertedRecipients.map(r => {
          let personalizedMsg = message;
          personalizedMsg = personalizedMsg.replace(/{name}/gi, r.name || 'Client').replace(/{information}/gi, r.information || '');
          return {
            campaign_id: campaign.id,
            recipient_id: r.id,
            phone_number: r.phone_number,
            personalized_message: personalizedMsg,
            status: 'pending'
          };
        });
        await supabase.from('campaign_messages').insert(messagesData);
      }

      await fetch(N8N_WEBHOOKS.launchCampaign, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaign.id })
      });

      navigate(`/campaigns/${campaign.id}`);

    } catch (err: any) {
      console.error(err);
      alert(`${t('common.error')}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getPreviewMessage = () => {
    const r = recipients[0] || { name: 'Ahmed Benani', information: 'VIP Client' };
    return message
      .replace(/{name}/gi, r.name || 'Client')
      .replace(/{information}/gi, r.information || '');
  };

  const StepIndicator = () => (
    <div className="flex items-center justify-center mb-8 sm:mb-10 w-full max-w-3xl mx-auto px-4">
      {[1, 2, 3, 4, 5].map((s) => (
        <React.Fragment key={s}>
          <div className="relative">
             <div className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm sm:text-lg transition-all duration-300 relative z-10 ${
                step === s ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/40 ring-2 sm:ring-4 ring-primary-100' : 
                step > s ? 'bg-green-500 text-white shadow-md shadow-green-500/20' : 'bg-gray-100 text-gray-400 border border-gray-200'
              }`}>
                {step > s ? <Check size={16} className="sm:w-6 sm:h-6" strokeWidth={3} /> : s}
                {step === s && (
                    <span className="absolute w-full h-full rounded-full bg-primary-400 opacity-20 animate-ping"></span>
                )}
             </div>
             <div className={`hidden sm:block absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-[10px] sm:text-xs font-semibold whitespace-nowrap ${step === s ? 'text-primary-700' : step > s ? 'text-green-600' : 'text-gray-400'}`}>
                {s === 1 && t('campaignNew.steps.info')}
                {s === 2 && t('campaignNew.steps.contacts')}
                {s === 3 && t('campaignNew.steps.message')}
                {s === 4 && t('campaignNew.steps.options')}
                {s === 5 && t('campaignNew.steps.launch')}
             </div>
          </div>
          {s !== 5 && (
            <div className="flex-1 h-1 mx-1 sm:h-1.5 sm:mx-2 bg-gray-100 rounded-full w-8 sm:w-20 relative overflow-hidden">
                 <div className={`absolute top-0 left-0 h-full bg-green-500 transition-all duration-500 ease-out rounded-full ${step > s ? 'w-full' : 'w-0'}`} style={{ [dir === 'rtl' ? 'right' : 'left']: 0 }}></div>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const getAcceptAttribute = () => {
    switch(mediaType) {
      case 'image': return 'image/*';
      case 'video': return 'video/*';
      case 'audio': return 'audio/*';
      case 'document': return '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt';
      default: return '*/*';
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-12 animate-fade-in">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8 text-center tracking-tight">{t('campaignNew.title')}</h1>
      <StepIndicator />

      <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-5 sm:p-8 md:p-12 min-h-[400px] sm:min-h-[500px] relative">
        
        {/* Step 1: Info */}
        {step === 1 && (
          <div className="space-y-6 max-w-2xl mx-auto animate-fade-in">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">{t('campaignNew.step1.title')}</h2>
            <div>
               <label className="block text-sm font-semibold text-gray-700 mb-2">{t('campaignNew.step1.nameLabel')}</label>
               <input
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-gray-900 focus:bg-white focus:ring-4 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all duration-200"
                placeholder={t('campaignNew.step1.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
               <label className="block text-sm font-semibold text-gray-700 mb-2">{t('campaignNew.step1.descLabel')} <span className="text-gray-400 font-normal">({t('campaignNew.step2.table.info')})</span></label>
               <textarea
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-gray-900 focus:bg-white focus:ring-4 focus:ring-primary-100 focus:border-primary-500 outline-none h-32 transition-all duration-200 resize-none"
                placeholder={t('campaignNew.step1.descPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="flex justify-end mt-8">
              <button
                onClick={() => name && setStep(2)}
                disabled={!name}
                className="w-full sm:w-auto bg-gradient-to-r from-primary-600 to-primary-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 hover:from-primary-700 hover:to-primary-800 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {t('campaignNew.step1.continue')} {dir === 'rtl' ? <ChevronLeft size={18} className="me-2" /> : <ChevronRight size={18} className="ms-2" />}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Contacts */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
               <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{t('campaignNew.step2.title')}</h2>
               {recipients.length > 0 && (
                 <span className="text-sm bg-primary-50 text-primary-700 font-bold px-4 py-1.5 rounded-full border border-primary-100">{recipients.length}</span>
               )}
            </div>
            
            <div className="border-2 border-dashed border-primary-200 rounded-2xl p-8 text-center bg-primary-50/30 hover:bg-primary-50 transition-colors relative group cursor-pointer">
              <input 
                type="file" 
                accept=".xlsx,.xls,.csv" 
                onChange={handleExcelUpload} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="flex flex-col items-center justify-center pointer-events-none group-hover:scale-105 transition-transform duration-200">
                <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 text-primary-500">
                    <FileSpreadsheet className="w-8 h-8" />
                </div>
                <p className="text-gray-800 font-semibold text-lg">{t('campaignNew.step2.uploadTitle')}</p>
                <p className="text-sm text-gray-500 mt-1">{t('campaignNew.step2.uploadSubtitle')}</p>
              </div>
            </div>

            {/* Table Area */}
            <div className="border-2 border-gray-300 rounded-2xl overflow-hidden flex flex-col max-h-[400px] shadow-sm">
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-sm text-start min-w-[600px]">
                  <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-xs tracking-wider border-b-2 border-gray-300 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4 w-1/4 text-start border-r border-gray-200">{t('campaignNew.step2.table.name')}</th>
                      <th className="px-6 py-4 w-1/4 text-start border-r border-gray-200">{t('campaignNew.step2.table.phone')}</th>
                      <th className="px-6 py-4 w-1/3 text-start border-r border-gray-200">{t('campaignNew.step2.table.info')}</th>
                      <th className="px-6 py-4 w-16 text-center">{t('campaignNew.step2.table.action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {recipients.map((recipient, index) => (
                      <tr key={index} className="hover:bg-gray-50 group transition-colors">
                        <td className="p-3 ps-6 border-r border-gray-200">
                          <input 
                            type="text" 
                            className="w-full px-3 py-2 border-2 border-gray-300 hover:border-primary-400 focus:border-primary-600 rounded-lg bg-white outline-none transition-all font-medium text-gray-700"
                            value={recipient.name}
                            onChange={(e) => handleUpdateRecipient(index, 'name', e.target.value)}
                          />
                        </td>
                        <td className="p-3 border-r border-gray-200">
                          <input 
                            type="text" 
                            className="w-full px-3 py-2 border-2 border-gray-300 hover:border-primary-400 focus:border-primary-600 rounded-lg bg-white outline-none transition-all font-mono text-gray-800 font-medium"
                            value={recipient.phone}
                            onChange={(e) => handleUpdateRecipient(index, 'phone', e.target.value)}
                          />
                        </td>
                        <td className="p-3 border-r border-gray-200">
                           <input 
                            type="text" 
                            className="w-full px-3 py-2 border-2 border-gray-300 hover:border-primary-400 focus:border-primary-600 rounded-lg bg-white outline-none transition-all font-medium text-gray-700"
                            value={recipient.information}
                            onChange={(e) => handleUpdateRecipient(index, 'information', e.target.value)}
                          />
                        </td>
                        <td className="p-3 pe-6 text-center">
                          <button 
                            onClick={() => handleDeleteRecipient(index)}
                            className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {recipients.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-16 text-gray-400 italic">
                          <div className="flex flex-col items-center">
                            <Users size={48} className="text-gray-200 mb-3" />
                            <span>{t('campaignNew.step2.empty')}</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="p-3 bg-gray-50 border-t border-gray-300">
                <button 
                  onClick={handleAddRecipient}
                  className="w-full py-3 flex items-center justify-center space-x-2 text-primary-700 font-semibold hover:bg-white rounded-xl border-2 border-dashed border-primary-200 hover:border-primary-400 hover:shadow-sm transition-all duration-200"
                >
                  <Plus size={18} />
                  <span>{t('campaignNew.step2.addManually')}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-between mt-8 pt-4 border-t border-gray-100 gap-4 sm:gap-0">
              <button onClick={() => setStep(1)} className="w-full sm:w-auto px-6 py-3 text-gray-500 hover:text-gray-800 font-medium transition-colors flex items-center justify-center sm:justify-start">
                  {dir === 'rtl' ? <ArrowLeft size={18} className="me-2 rotate-180" /> : <ArrowLeft size={18} className="me-2" />} {t('campaignNew.back')}
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={recipients.length === 0}
                className="w-full sm:w-auto bg-gradient-to-r from-primary-600 to-primary-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 hover:from-primary-700 hover:to-primary-800 transition-all duration-200 active:scale-95 disabled:opacity-50 flex items-center justify-center"
              >
                {t('campaignNew.next')} {dir === 'rtl' ? <ChevronLeft size={18} className="me-2" /> : <ChevronRight size={18} className="ms-2" />}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Content */}
        {step === 3 && (
          <div className="space-y-8 animate-fade-in max-w-3xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{t('campaignNew.step3.title')}</h2>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('campaignNew.step3.messageLabel')}</label>
              <textarea
                className="w-full px-5 py-4 rounded-xl border border-gray-200 bg-gray-50/50 text-gray-900 focus:bg-white focus:ring-4 focus:ring-primary-100 focus:border-primary-500 outline-none h-48 font-mono text-sm shadow-inner transition-all duration-200 resize-y"
                placeholder={t('campaignNew.step3.messagePlaceholder')}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <div className="flex gap-2 mt-3 flex-wrap">
                 <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-full sm:w-auto">{t('campaignNew.step3.variables')}:</span>
                 <button onClick={() => setMessage(prev => prev + ' {name}')} className="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded hover:bg-primary-100 transition-colors font-mono">{'{name}'}</button>
                 <button onClick={() => setMessage(prev => prev + ' {information}')} className="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded hover:bg-primary-100 transition-colors font-mono">{'{information}'}</button>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700">{t('campaignNew.step3.mediaType')}</label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { id: '', icon: XCircle, label: t('campaignNew.step3.noMedia') },
                  { id: 'image', icon: ImageIcon, label: t('campaignNew.step3.image') },
                  { id: 'video', icon: Video, label: t('campaignNew.step3.video') },
                  { id: 'audio', icon: Mic, label: t('campaignNew.step3.audio') },
                  { id: 'document', icon: FileText, label: t('campaignNew.step3.document') }
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => { setMediaType(type.id); setMediaFile(null); }}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 ${
                      mediaType === type.id 
                        ? 'border-primary-500 bg-primary-50 text-primary-700' 
                        : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200 hover:bg-white'
                    }`}
                  >
                    <type.icon size={24} className="mb-2" />
                    <span className="text-xs font-bold text-center leading-tight">{type.label.split(' ')[0]}</span>
                  </button>
                ))}
              </div>

              {mediaType && (
                <div className="animate-fade-in mt-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{t('campaignNew.step3.file')}</label>
                  {!mediaFile ? (
                    <label className="flex flex-col items-center justify-center w-full px-6 py-8 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-500 cursor-pointer hover:bg-white hover:border-primary-400 hover:text-primary-600 transition-all duration-200 group">
                       <Upload size={32} className="mb-2 group-hover:scale-110 transition-transform" />
                       <span className="text-sm font-medium">{t('campaignNew.step3.chooseFile')}</span>
                       <span className="text-xs text-gray-400 mt-1 text-center">
                         {mediaType === 'image' && 'JPG, PNG, WEBP'}
                         {mediaType === 'video' && 'MP4, MOV'}
                         {mediaType === 'audio' && 'MP3, WAV, OGG'}
                         {mediaType === 'document' && 'PDF, DOC, XLS, TXT'}
                       </span>
                       <input 
                          type="file" 
                          accept={getAcceptAttribute()}
                          onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                    </label>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-white border border-primary-100 rounded-xl shadow-sm ring-1 ring-primary-50">
                      <div className="flex items-center overflow-hidden">
                           <div className="bg-primary-100 p-3 rounded-lg me-4 text-primary-600">
                              {mediaType === 'image' ? <ImageIcon size={24} /> : 
                               mediaType === 'video' ? <Video size={24} /> :
                               mediaType === 'audio' ? <Mic size={24} /> :
                               <FileText size={24} />}
                           </div>
                           <div className="truncate pe-2">
                              <p className="font-semibold text-gray-800 truncate">{mediaFile.name}</p>
                              <p className="text-xs text-gray-500">{(mediaFile.size / 1024 / 1024).toFixed(2)} MB</p>
                           </div>
                      </div>
                      <button 
                          onClick={() => setMediaFile(null)}
                          className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2.5 rounded-lg transition-colors"
                      >
                          <Trash2 size={20} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* WhatsApp Preview Component */}
            <div className="bg-[#E5DDD5] p-6 rounded-2xl shadow-inner border border-gray-200 mt-8 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-2 bg-black/10"></div>
               <div className="flex flex-col space-y-2 max-w-sm mx-auto sm:mx-0">
                  <div className="bg-white rounded-lg rounded-tl-none p-2 shadow-sm self-start relative max-w-[90%]">
                     {/* Media Preview */}
                     {previewUrl && (
                        <div className="mb-2 rounded-md overflow-hidden bg-black/5 flex justify-center items-center">
                           {mediaType === 'image' && <img src={previewUrl} alt="Preview" className="w-full h-auto object-cover max-h-64" />}
                           {mediaType === 'video' && <video src={previewUrl} controls className="w-full h-auto max-h-64" />}
                           {mediaType === 'audio' && <audio src={previewUrl} controls className="w-full mt-2" />}
                           {mediaType === 'document' && (
                              <div className="flex items-center p-4 bg-gray-100 rounded-lg w-full">
                                 <FileText size={32} className="text-red-500 mr-3" />
                                 <span className="font-medium text-sm truncate">{mediaFile?.name}</span>
                              </div>
                           )}
                        </div>
                     )}
                     
                     {/* Text Message */}
                     <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed px-1">
                        {getPreviewMessage() || <span className="text-gray-400 italic">Votre message apparaîtra ici...</span>}
                     </p>
                     
                     {/* Timestamp */}
                     <div className="flex justify-end items-center mt-1 space-x-1">
                        <span className="text-[10px] text-gray-500">
                           {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                        <CheckCheck size={14} className="text-blue-500" />
                     </div>
                     
                     {/* Tail */}
                     <div className="absolute top-0 -left-2 w-0 h-0 border-t-[10px] border-t-white border-l-[10px] border-l-transparent"></div>
                  </div>
               </div>

               {/* Info Box */}
               <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-start">
                  <AlertCircle size={16} className="text-yellow-600 mt-0.5 mr-2 shrink-0" />
                  <p className="text-xs text-yellow-800">
                     <strong>Aperçu :</strong> Ce message est généré en utilisant les données du premier destinataire de votre liste.
                  </p>
               </div>
            </div>

            <div className="flex items-center space-x-4 rtl:space-x-reverse p-5 bg-gradient-to-r from-purple-50 to-white rounded-2xl border border-purple-100 shadow-sm">
              <div className="relative flex items-center">
                 <input 
                    type="checkbox" 
                    id="ai-toggle"
                    checked={aiEnabled} 
                    onChange={(e) => setAiEnabled(e.target.checked)}
                    className="peer h-6 w-6 cursor-pointer appearance-none rounded-md border border-purple-200 bg-white checked:border-purple-600 checked:bg-purple-600 transition-all" 
                 />
                 <Check size={16} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" />
              </div>
              <label htmlFor="ai-toggle" className="flex-1 cursor-pointer select-none">
                <span className="block font-bold text-purple-900 flex items-center text-lg mb-1">
                  <Sparkles size={20} className="me-2 text-purple-600" />
                  {t('campaignNew.step3.aiTitle')}
                </span>
                <span className="text-sm text-purple-600 leading-snug">{t('campaignNew.step3.aiDesc')}</span>
              </label>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-between mt-8 pt-4 border-t border-gray-100 gap-4 sm:gap-0">
              <button onClick={() => setStep(2)} className="w-full sm:w-auto px-6 py-3 text-gray-500 hover:text-gray-800 font-medium transition-colors flex items-center justify-center sm:justify-start">
                  {dir === 'rtl' ? <ArrowLeft size={18} className="me-2 rotate-180" /> : <ArrowLeft size={18} className="me-2" />} {t('campaignNew.back')}
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={!message}
                className="w-full sm:w-auto bg-gradient-to-r from-primary-600 to-primary-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 hover:from-primary-700 hover:to-primary-800 transition-all duration-200 active:scale-95 disabled:opacity-50 flex items-center justify-center"
              >
                {t('campaignNew.next')} {dir === 'rtl' ? <ChevronLeft size={18} className="me-2" /> : <ChevronRight size={18} className="ms-2" />}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Schedule */}
        {step === 4 && (
          <div className="space-y-8 animate-fade-in max-w-2xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{t('campaignNew.step4.title')}</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <button 
                 onClick={() => setTiming('now')}
                 className={`relative p-6 rounded-2xl border-2 text-start transition-all duration-200 flex flex-col items-center justify-center gap-4 group ${
                   timing === 'now' 
                     ? 'border-primary-500 bg-primary-50/50 shadow-lg shadow-primary-500/10' 
                     : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-md'
                 }`}
               >
                 <div className={`p-4 rounded-full ${timing === 'now' ? 'bg-primary-100 text-primary-600' : 'bg-gray-50 text-gray-400 group-hover:bg-primary-50 group-hover:text-primary-500'} transition-colors`}>
                    <Send size={32} />
                 </div>
                 <div className="text-center">
                    <span className={`block text-lg font-bold ${timing === 'now' ? 'text-primary-900' : 'text-gray-700'}`}>{t('campaignNew.step4.sendNow')}</span>
                    <span className="text-xs text-gray-500 mt-1 block">La campagne démarrera immédiatement après validation.</span>
                 </div>
                 {timing === 'now' && <div className="absolute top-4 right-4 text-primary-600"><Check size={24} /></div>}
               </button>

               <button 
                 onClick={() => setTiming('scheduled')}
                 className={`relative p-6 rounded-2xl border-2 text-start transition-all duration-200 flex flex-col items-center justify-center gap-4 group ${
                   timing === 'scheduled' 
                     ? 'border-primary-500 bg-primary-50/50 shadow-lg shadow-primary-500/10' 
                     : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-md'
                 }`}
               >
                 <div className={`p-4 rounded-full ${timing === 'scheduled' ? 'bg-primary-100 text-primary-600' : 'bg-gray-50 text-gray-400 group-hover:bg-primary-50 group-hover:text-primary-500'} transition-colors`}>
                    <Calendar size={32} />
                 </div>
                 <div className="text-center">
                    <span className={`block text-lg font-bold ${timing === 'scheduled' ? 'text-primary-900' : 'text-gray-700'}`}>{t('campaignNew.step4.schedule')}</span>
                    <span className="text-xs text-gray-500 mt-1 block">Choisissez une date et une heure précise pour l'envoi.</span>
                 </div>
                 {timing === 'scheduled' && <div className="absolute top-4 right-4 text-primary-600"><Check size={24} /></div>}
               </button>
            </div>

            {timing === 'scheduled' && (
               <div className="bg-white p-6 rounded-2xl border border-primary-100 shadow-sm animate-fade-in">
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                    <Calendar size={16} className="me-2 text-primary-500" />
                    Date et Heure de lancement
                  </label>
                  <input 
                     type="datetime-local" 
                     className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-900 focus:bg-white focus:ring-4 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all font-medium"
                     value={scheduledTime}
                     onChange={(e) => setScheduledTime(e.target.value)}
                  />
                  {scheduledTime && (
                    <p className="mt-3 text-sm text-gray-500 flex items-center bg-gray-50 p-3 rounded-lg">
                      <Clock size={14} className="me-2" />
                      Envoi prévu le : <span className="font-bold text-gray-900 ms-1">{new Date(scheduledTime).toLocaleString()}</span>
                    </p>
                  )}
               </div>
            )}

            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
                    <Clock size={18} className="me-2 text-gray-500" />
                    {t('campaignNew.step4.delaysTitle')}
                </h3>
                <div className="grid grid-cols-2 gap-6">
                   <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{t('campaignNew.step4.min')}</label>
                     <input type="number" value={minDelay} onChange={(e) => setMinDelay(Number(e.target.value))} className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-4 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all text-center font-semibold" />
                   </div>
                   <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{t('campaignNew.step4.max')}</label>
                     <input type="number" value={maxDelay} onChange={(e) => setMaxDelay(Number(e.target.value))} className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-4 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all text-center font-semibold" />
                   </div>
                </div>
                <div className="mt-4 text-xs text-orange-700 bg-orange-50 border border-orange-100 p-3 rounded-lg flex items-start">
                  <AlertCircle size={14} className="me-2 mt-0.5 shrink-0" />
                  {t('campaignNew.step4.warning')}
                </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-between mt-8 pt-4 border-t border-gray-100 gap-4 sm:gap-0">
              <button onClick={() => setStep(3)} className="w-full sm:w-auto px-6 py-3 text-gray-500 hover:text-gray-800 font-medium transition-colors flex items-center justify-center sm:justify-start">
                  {dir === 'rtl' ? <ArrowLeft size={18} className="me-2 rotate-180" /> : <ArrowLeft size={18} className="me-2" />} {t('campaignNew.back')}
              </button>
              <button
                onClick={() => setStep(5)}
                className="w-full sm:w-auto bg-gradient-to-r from-primary-600 to-primary-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 hover:from-primary-700 hover:to-primary-800 transition-all duration-200 active:scale-95 flex items-center justify-center"
              >
                {t('campaignNew.next')} {dir === 'rtl' ? <ChevronLeft size={18} className="me-2" /> : <ChevronRight size={18} className="ms-2" />}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Summary */}
        {step === 5 && (
          <div className="space-y-8 animate-fade-in max-w-2xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 text-center">{t('campaignNew.step5.title')}</h2>
            
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-gray-500 font-medium">{t('campaignNew.step1.nameLabel')}</span>
                    <span className="font-bold text-gray-900 text-lg">{name}</span>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-gray-500 flex items-center"><Users size={16} className="me-2" /> {t('campaignNew.step5.recipients')}</span>
                    <span className="font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded-full">{recipients.length}</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-gray-500 flex items-center"><Smartphone size={16} className="me-2" /> {t('campaignNew.step5.session')}</span>
                    <div className="flex flex-col items-end">
                      <select 
                        className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-primary-200 outline-none max-w-[150px] sm:max-w-none"
                        value={selectedSessionId}
                        onChange={(e) => setSelectedSessionId(e.target.value)}
                      >
                        {sessions.map(s => <option key={s.id} value={s.id}>{s.session_name}</option>)}
                      </select>
                      <button onClick={getSessions} className="text-xs text-primary-600 hover:underline mt-1 flex items-center font-medium">
                        <RefreshCw size={10} className="me-1" /> {t('campaignNew.step5.refreshList')}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-gray-500 flex items-center"><Sparkles size={16} className="me-2" /> {t('campaignNew.step5.aiEnabled')}</span>
                    <span className={`font-bold px-3 py-1 rounded-full text-sm ${aiEnabled ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                        {aiEnabled ? t('common.yes') : t('common.no')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-500 flex items-center"><ImageIcon size={16} className="me-2" /> {t('campaignNew.step5.media')}</span>
                    <div className="text-end">
                        <span className="font-bold text-gray-900 block">{mediaType || t('campaignNew.step3.noMedia')}</span>
                        {mediaFile && <span className="text-xs text-gray-400 block truncate max-w-[150px]">{mediaFile.name}</span>}
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 p-6 border-t border-gray-200">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{t('campaignNew.step5.preview')}</p>
                    <p className="text-sm text-gray-600 italic bg-white p-4 rounded-xl border border-gray-200">"{message.substring(0, 150)}{message.length > 150 ? '...' : ''}"</p>
                </div>
            </div>

            {sessions.length === 0 && (
              <div className="flex items-center p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                <AlertCircle size={20} className="me-3 shrink-0" />
                <div>
                   <span className="font-bold block">{t('campaignNew.step5.noSession')}</span>
                   {t('campaignNew.step5.noSessionMsg')}
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row justify-between mt-8 pt-4 border-t border-gray-100 gap-4 sm:gap-0">
              <button onClick={() => setStep(4)} className="w-full sm:w-auto px-6 py-3 text-gray-500 hover:text-gray-800 font-medium transition-colors flex items-center justify-center sm:justify-start">
                  {dir === 'rtl' ? <ArrowLeft size={18} className="me-2 rotate-180" /> : <ArrowLeft size={18} className="me-2" />} {t('campaignNew.back')}
              </button>
              <button
                onClick={launchCampaign}
                disabled={loading || !selectedSessionId}
                className="w-full sm:w-auto bg-gradient-to-r from-green-500 to-green-600 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-xl shadow-green-500/30 hover:shadow-green-500/40 hover:from-green-600 hover:to-green-700 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[200px]"
              >
                {loading ? <Loader2 className="animate-spin me-2" /> : <span className="me-2">🚀</span>}
                {loading ? t('campaignNew.step5.launching') : t('campaignNew.step5.launchBtn')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignNew;