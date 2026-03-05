import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../App';
import { N8N_WEBHOOKS } from '../constants';
import { validateMoroccoPhone } from '../services/utils';
import { Loader2, ArrowRight } from 'lucide-react';

const Signup: React.FC = () => {
  const [step, setStep] = useState(1); // 1: Form, 2: OTP
  const [formData, setFormData] = useState({
    full_name: '',
    phone_number: ''
  });
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login } = useAuth();
  const navigate = useNavigate();

  // Step 1: Create Account + Send OTP
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (formData.full_name.trim().length < 2) {
        setError('⚠️ Le nom doit contenir au moins 2 caractères.');
        setLoading(false);
        return;
    }

    // Validation Phone
    const validation = validateMoroccoPhone(formData.phone_number);
    if (!validation.valid) {
      setError(validation.error || '🚫 Numéro invalide');
      setLoading(false);
      return;
    }
    const normalizedPhone = validation.normalized || formData.phone_number;

    try {
      // 1. Create Account
      const signupRes = await fetch(N8N_WEBHOOKS.signup, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, phone_number: normalizedPhone })
      });
      
      if (signupRes.status === 409) {
          throw new Error("⚠️ Ce numéro est déjà enregistré. Connectez-vous !");
      }

      const signupText = await signupRes.text();
      let signupData = signupText ? JSON.parse(signupText) : {};
      
      if (!signupData.success) {
        throw new Error(signupData.message);
      }

      // 2. Send OTP
      const otpRes = await fetch(N8N_WEBHOOKS.sendOTP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: normalizedPhone })
      });
      
      const otpText = await otpRes.text();
      let otpData = otpText ? JSON.parse(otpText) : {};
      
      if (!otpData.success) {
        throw new Error(otpData.message);
      }

      setFormData(prev => ({ ...prev, phone_number: normalizedPhone }));
      setStep(2);
    } catch (err: any) {
      setError(err.message || '⚠️ Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otpCode.length !== 6) {
        setError("⚠️ Le code doit contenir 6 chiffres");
        return;
    }

    setLoading(true);

    try {
      const res = await fetch(N8N_WEBHOOKS.verifyOTP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: formData.phone_number,
          code: otpCode
        })
      });
      
      const text = await res.text();
      let data = text ? JSON.parse(text) : {};

      if (!data.success) {
         if (data.message && data.message.toLowerCase().includes('expired')) {
             throw new Error('⏰ Le code a expiré. Retournez en arrière pour en demander un nouveau.');
         }
         throw new Error(data.message || '❌ Code invalide');
      }

      if (data.subscription) {
        localStorage.setItem('subscription', JSON.stringify(data.subscription));
      }
      
      const sessionData = data.session || (data.access_token ? { 
        access_token: data.access_token, 
        refresh_token: data.refresh_token 
      } : undefined);
      
      login(data.user, sessionData);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || '⚠️ Erreur de validation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-gray-200/50 p-6 sm:p-10 border border-gray-100">
        <div className="flex flex-col items-center mb-8">
            <img 
              src="https://nlfixnhoufntbbcccnwr.supabase.co/storage/v1/object/public/campaigns/b131c9ef-add4-4bec-964f-9b6c56144392/hf_20260123_210131_ee457ba5-c6a1-4011-82b4-437d7427d82b-removebg-preview.png" 
              alt="Verde.ai" 
              className="w-24 h-24 mb-4 object-contain"
            />
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 tracking-tight text-center">
              Créer un Compte
            </h2>
            <p className="text-gray-500 mt-2 text-center">Rejoignez Verde.ai aujourd'hui</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm text-center font-medium animate-pulse">
            {error}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSignup} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nom complet
              </label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                placeholder="Ex: Ahmed Benani"
                className="w-full px-5 py-3.5 rounded-xl border border-gray-200 bg-gray-50/50 text-gray-900 focus:bg-white focus:ring-4 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Numéro WhatsApp
              </label>
              <input
                type="tel"
                required
                value={formData.phone_number}
                onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                placeholder="212 6XX XXX XXX"
                className="w-full px-5 py-3.5 rounded-xl border border-gray-200 bg-gray-50/50 text-gray-900 focus:bg-white focus:ring-4 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all duration-200"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 transition-all duration-200 active:scale-95 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="animate-spin" /> : <span className="flex items-center">Créer le Compte <ArrowRight size={18} className="ml-2"/></span>}
            </button>

            <p className="text-center text-sm text-gray-600 mt-4">
              Déjà un compte? <Link to="/login" className="text-primary-600 font-semibold hover:underline">Se connecter</Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-5">
            <div className="bg-primary-50 p-4 rounded-xl text-center mb-2">
                <p className="text-sm text-primary-800">
                Code envoyé à <strong className="font-mono text-primary-900 break-all">{formData.phone_number}</strong>
                </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Code de vérification
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="123456"
                className="w-full px-5 py-3.5 rounded-xl border border-gray-200 bg-gray-50/50 text-gray-900 focus:bg-white focus:ring-4 focus:ring-primary-100 focus:border-primary-500 outline-none text-center text-2xl tracking-widest transition-all duration-200 font-mono"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 transition-all duration-200 active:scale-95 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="animate-spin" /> : <span>Vérifier et Accéder</span>}
            </button>

            <button
              type="button"
              onClick={() => setStep(1)}
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

export default Signup;