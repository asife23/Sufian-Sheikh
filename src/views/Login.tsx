import React, { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Activity, Mail, Lock, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // Email state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const [name, setName] = useState('');

  const [step, setStep] = useState<'methods' | 'email'>('methods');

  if (currentUser) {
    return <Navigate to="/" replace />;
  }

  const bootstrapUser = async (uid: string, displayName: string | null = null, phone: string | null = null) => {
    const userRef = doc(db, 'users', uid);
    // Use setDoc with merge: true but only for fields that shouldn't be overwritten if they exist
    // Actually, it's better to fetch first to check if user exists.
    // However, to avoid an extra read if not necessary, we can just use setDoc with merge for fields.
    // BUT we don't want to overwrite the name, phone, or createdAt if they exist.
    // Setting merge: true will overwrite them. 
    // Let's retrieve the doc first.
    try {
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          userId: uid,
          name: displayName || 'খামারি',
          phone: phone || '',
          createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      await bootstrapUser(result.user.uid, result.user.displayName, (result.user as any).phoneNumber || null);
      toast.success('সফলভাবে লগইন হয়েছে!');
      navigate('/', { replace: true });
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        toast.error('লগইন উইন্ডোটি বন্ধ করে দেওয়া হয়েছে।');
      } else if (error.code === 'auth/unauthorized-domain') {
        toast.error('এই ডোমেইনটি Firebase-এ অনুমোদিত নয়।');
      } else {
        toast.error('লগইন ব্যর্থ হয়েছে: ' + error.message);
      }
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

    const handleEmailAuth = async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedEmail = email.trim();
      if (!trimmedEmail || !password) {
        toast.error('ইমেইল এবং পাসওয়ার্ড দিন।');
        return;
      }
      if (isSignUp && !name) {
        toast.error('আপনার নাম দিন।');
        return;
      }
      setLoading(true);
      try {
        if (isSignUp) {
          const result = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
          await bootstrapUser(result.user.uid, name, null);
          toast.success('সফলভাবে অ্যাকাউন্ট তৈরি হয়েছে!');
          navigate('/', { replace: true });
        } else {
          await signInWithEmailAndPassword(auth, trimmedEmail, password);
          toast.success('সফলভাবে লগইন হয়েছে!');
          navigate('/', { replace: true });
        }
      } catch (error: any) {
        console.error("Auth error details:", error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('এই ইমেইলটি আগে থেকেই ব্যবহৃত হচ্ছে।');
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        toast.error('ইমেইল অথবা পাসওয়ার্ড ভুল।');
      } else if (error.code === 'auth/weak-password') {
        toast.error('পাসওয়ার্ড খুব সহজ, অন্তত ৬ অক্ষরের হতে হবে।');
      } else if (error.code === 'auth/operation-not-allowed') {
        toast.error('ইমেইল/পাসওয়ার্ড লগইন Firebase Console-এ চালু করা নেই। দয়া করে Authentication -> Sign-in method থেকে Email/Password চালু করুন।');
      } else {
        toast.error('Error: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-green-600 p-8 text-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Activity className="text-green-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">ডিজিটাল খামার প্রো</h1>
          <p className="text-green-100">উন্নত খামার ব্যবস্থাপনা সফটওয়্যার</p>
        </div>
        
        <div className="p-8">
          {step === 'methods' && (
            <>
              <p className="text-gray-600 text-center mb-8">
                আপনার খামারের হিসাব রাখতে লগইন করুন
              </p>
              <div className="space-y-4">
                <button
                  onClick={() => { setStep('email'); setIsSignUp(false); }}
                  className="w-full flex items-center justify-center gap-3 bg-blue-50 border-2 border-blue-600 text-blue-700 font-semibold py-3 px-4 rounded-xl hover:bg-blue-100 transition-all"
                >
                  <Mail size={20} />
                  ইমেইল দিয়ে লগইন / রেজিস্ট্রেশন
                </button>
                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-gray-300"></div>
                  <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">অথবা</span>
                  <div className="flex-grow border-t border-gray-300"></div>
                </div>
                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-all disabled:opacity-50"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
                  {loading ? 'অপেক্ষা করুন...' : 'গুগল দিয়ে লগইন করুন'}
                </button>
              </div>
            </>
          )}

          {step === 'email' && (
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <h2 className="text-xl font-bold text-gray-800 text-center mb-4">{isSignUp ? 'নতুন অ্যাকাউন্ট তৈরি করুন' : 'ইমেইল দিয়ে লগইন করুন'}</h2>
              {isSignUp && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">পুরো নাম</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <UserPlus className="text-gray-400" size={20} />
                    </div>
                    <input
                      type="text"
                      placeholder="আপনার নাম"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-600"
                      required={isSignUp}
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ইমেইল</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="text-gray-400" size={20} />
                  </div>
                  <input
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-600"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">পাসওয়ার্ড</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="text-gray-400" size={20} />
                  </div>
                  <input
                    type="password"
                    placeholder="******"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-600"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {loading ? 'অপেক্ষা করুন...' : (isSignUp ? 'অ্যাকাউন্ট তৈরি করুন' : 'লগইন করুন')}
              </button>
              
              <div className="flex flex-col gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="w-full text-blue-600 font-medium py-2 hover:underline"
                >
                  {isSignUp ? 'আগে থেকে অ্যাকাউন্ট থাকলে লগইন করুন' : 'নতুন অ্যাকাউন্ট তৈরি করুন'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('methods');
                    setIsSignUp(false);
                  }}
                  className="w-full text-gray-500 font-medium py-2"
                >
                  ফিরে যান
                </button>
              </div>
            </form>
          )}
        </div>
        <div className="bg-gray-50 border-t border-gray-100 p-4 text-center">
          <p className="text-xs text-gray-500">
            By continuing, you agree to our <Link to="/privacy-policy" className="text-blue-600 hover:underline">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
