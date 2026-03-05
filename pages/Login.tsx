import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../App';
import { N8N_WEBHOOKS } from '../constants';
import { ArrowRight, Loader2, CheckCircle } from 'lucide-react';
import { validateMoroccoPhone } from '../services/utils';

const Login: React.FC = () => {
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const validation = validateMoroccoPhone(phone);
    if (!validation.valid) {
      setError(validation.error || '🚫 Numéro invalide');
      return;
    }

    const normalizedPhone = validation.normalized;
    setPhone(normalizedPhone || phone);

    setLoading(true);
    try {
      const response = await fetch(N8N_WEBHOOKS.sendOTP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: normalizedPhone })
      });

      if (response.status === 404) {
          setError("🚫 Ce numéro n'est pas enregistré. Veuillez créer un compte !");
          setLoading(false);
          return;
      }
      
      const text = await response.text();
      let data = text ? JSON.parse(text) : {};

      if (data.success) {
        setStep('OTP');
      } else {
        setError(data.message || '⚠️ Erreur lors de l\'envoi du code.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || '⚠️ Erreur de connexion serveur.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otp.length !== 6) {
        setError("⚠️ Le code doit contenir 6 chiffres");
        return;
    }

    setLoading(true);

    try {
      const response = await fetch(N8N_WEBHOOKS.verifyOTP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone, code: otp })
      });

      const text = await response.text();
      let data = text ? JSON.parse(text) : {};

      if (data.success) {
        if (data.subscription) {
            localStorage.setItem('subscription', JSON.stringify(data.subscription));
        }
        const sessionData = data.session || (data.access_token ? { 
            access_token: data.access_token, 
            refresh_token: data.refresh_token 
        } : undefined);

        login(data.user, sessionData);
        navigate('/dashboard');
      } else {
        if (data.message && data.message.toLowerCase().includes('expired')) {
             setError('⏰ Le code a expiré. Veuillez en demander un nouveau.');
        } else {
             setError('❌ Code de vérification incorrect.');
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || '⚠️ Erreur de vérification.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-gray-200/50 p-6 sm:p-10 border border-gray-100">
        <div className="flex flex-col items-center mb-8">
            <img 
              src="https://nlfixnhoufntbbcccnwr.supabase.co/storage/v1/object/public/campaigns/b131c9ef-add4-4bec-964f-9b6c56144392/hf_20260123_210131_ee457ba5-c6a1-4011-82b4-437d7427d82b-removebg-preview.png" 
              alt="Verde.ai" 
              className="w-24 h-24 mb-4 object-contain"
            />
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 tracking-tight text-center">
            Connexion
            </h2>
            <p className="text-gray-500 mt-2 text-center">Accédez à votre espace Verde.ai</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-100 rounded-xl text-sm text-center font-medium animate-pulse">
            {error}
          </div>
        )}

        {step === 'PHONE' ? (
          <form onSubmit={handleSendOtp} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Numéro WhatsApp</label>
              <input
                type="tel"
                placeholder="212 6XX XXX XXX"
                className="w-full px-5 py-3.5 rounded-xl border border-gray-200 bg-gray-50/50 text-gray-900 focus:bg-white focus:ring-4 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all duration-200"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 transition-all duration-200 active:scale-95 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="animate-spin" /> : <span className="flex items-center">Envoyer le Code <ArrowRight size={18} className="ml-2"/></span>}
            </button>
            <p className="text-center text-sm text-gray-600 mt-4">
              Pas encore de compte? <Link to="/signup" className="text-primary-600 font-semibold hover:underline">S'inscrire</Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div className="bg-primary-50 p-4 rounded-xl text-center mb-2">
                <p className="text-sm text-primary-800">
                Code envoyé à <strong className="font-mono text-primary-900 break-all">{phone}</strong>
                </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Code de vérification</label>
              <input
                type="text"
                placeholder="123456"
                maxLength={6}
                className="w-full px-5 py-3.5 rounded-xl border border-gray-200 bg-gray-50/50 text-gray-900 focus:bg-white focus:ring-4 focus:ring-primary-100 focus:border-primary-500 outline-none text-center text-2xl tracking-widest transition-all duration-200 font-mono"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 transition-all duration-200 active:scale-95 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="animate-spin" /> : <span>Se Connecter</span>}
            </button>
            <button
              type="button"
              onClick={() => setStep('PHONE')}
              className="w-full text-sm text-gray-500 hover:text-gray-800 font-medium transition-colors"
            >
              Modifier le numéro
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;