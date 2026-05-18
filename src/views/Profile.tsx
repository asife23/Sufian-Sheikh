import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, offlineSafeDocWrite, fastGetDocs } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage, Language } from '../contexts/LanguageContext';
import { User, LogOut, CheckCircle, Settings, HelpCircle, Info, Globe, ChevronRight, X, MessageCircle, Phone, Mail, ExternalLink, ShieldCheck, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { currentUser, logout } = useAuth();
  const { language: currentLanguage, setLanguage: setGlobalLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLock = useRef(false);
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [farmName, setFarmName] = useState('');
  const [language, setLanguage] = useState<Language>(currentLanguage);
  const [showDeveloperSupport, setShowDeveloperSupport] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    setLanguage(currentLanguage);
  }, [currentLanguage]);

  useEffect(() => {
    if (currentUser) {
      if (currentUser.displayName && !name) setName(currentUser.displayName);
      fetchProfile();
    }
  }, [currentUser]);

  const fetchProfile = async () => {
    if (!currentUser) return;
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.name) setName(data.name);
        if (data.phone) setPhone(data.phone);
        if (data.farmName) setFarmName(data.farmName);
        if (data.language) setLanguage(data.language);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (isSubmitting || submitLock.current) return;
    setIsSubmitting(true);
    submitLock.current = true;
    
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const docSnap = await getDoc(userRef);
      
      const payload = {
        userId: currentUser.uid,
        name,
        phone,
        farmName,
        language,
        updatedAt: new Date().toISOString()
      };

      if (docSnap.exists()) {
        await offlineSafeDocWrite(updateDoc(userRef, {
          name,
          phone,
          farmName,
          language,
          updatedAt: new Date().toISOString()
        }));
      } else {
        await offlineSafeDocWrite(setDoc(userRef, {
          ...payload,
          createdAt: new Date().toISOString()
        }));
      }
      
      setGlobalLanguage(language as Language);
      toast.success(currentLanguage === 'en' ? 'Profile updated!' : 'প্রোফাইল আপডেট হয়েছে!');
    } catch (error) {
      toast.error(t('common.error'));
      handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}`);
    } finally {
      setIsSubmitting(false);
      submitLock.current = false;
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error(t('common.error'));
      navigate('/login');
    }
  };

  if (loading) return <div className="text-center py-10">{t('common.loading')}</div>;

  return (
    <div className="space-y-4 pb-4">
      <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Settings className="text-blue-500" /> {t('menu.profile')}
        </h2>
        <button 
          onClick={handleLogout}
          className="text-red-500 hover:bg-red-50 p-2 rounded-lg flex items-center gap-1 text-sm font-semibold"
        >
          <LogOut size={18} /> {t('profile.logout')} 
        </button>
      </div>

      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center">
        <div className="w-20 h-20 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center mb-3">
          {currentUser?.photoURL ? (
            <img src={currentUser.photoURL} alt="Profile" className="w-full h-full rounded-full object-cover" />
          ) : (
             <User size={40} />
          )}
        </div>
        <h3 className="font-bold text-lg text-gray-800">{name || (currentLanguage === 'en' ? 'Name not set' : 'নাম সেট করা নেই')}</h3>
        <p className="text-sm text-gray-500">{currentUser?.email}</p>
      </div>

      <form onSubmit={handleSave} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <h3 className="font-bold text-gray-800 border-b pb-2">{t('profile.title')}</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.name')}</label>
          <input 
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500" 
            placeholder={t('profile.name')} 
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.phone')}</label>
          <input 
            type="tel" 
            value={phone} 
            onChange={(e) => setPhone(e.target.value)} 
            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500" 
            placeholder="017xxxxxxxx" 
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.farmName')}</label>
          <input 
            type="text" 
            value={farmName} 
            onChange={(e) => setFarmName(e.target.value)} 
            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500" 
            placeholder={t('profile.farmNamePlaceholder')}
            autoComplete="off"
            id="farmName-input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
             <Globe size={16} className="text-gray-500"/> {t('profile.appLanguage')}
          </label>
          <select 
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="bn">{t('profile.bengali')}</option>
            <option value="en">{t('profile.english')}</option>
          </select>
        </div>

        <button disabled={isSubmitting} type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl mt-6 flex items-center justify-center gap-2 disabled:bg-gray-400">
          <CheckCircle size={20} /> {isSubmitting ? t('profile.saving') : t('profile.save')}
        </button>
      </form>

      {/* Support & About Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100 mt-4">
        <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors" onClick={() => setShowDeveloperSupport(true)}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
              <HelpCircle size={18} />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-800 text-sm">{t('profile.support')}</p>
              <p className="text-xs text-gray-500">{t('profile.supportWait')}</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>

        <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors" onClick={() => setShowAbout(true)}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
              <Info size={18} />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-800 text-sm">{t('profile.about')}</p>
              <p className="text-xs text-gray-500">{t('profile.aboutSub')}</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>
        <button onClick={() => navigate('/privacy-policy')} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
              <FileText size={18} />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-800 text-sm">{t('profile.privacyPolicy')}</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>
      </div>

      {showDeveloperSupport && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-br from-blue-700 to-indigo-800 p-6 text-center relative">
              <button 
                onClick={() => setShowDeveloperSupport(false)}
                className="absolute top-3 right-3 text-white/70 hover:text-white bg-black/10 hover:bg-black/20 rounded-full p-2 transition-colors"
              >
                <X size={20} />
              </button>
              <div className="w-24 h-24 bg-white/10 backdrop-blur-xl rounded-full mx-auto flex items-center justify-center mb-3 shadow-lg p-1 border border-white/20">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=AbuSufian&backgroundColor=b6e3f4`} alt="Developer" className="w-full h-full rounded-full" />
              </div>
              <h3 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
                আবু সুফিয়ান <ShieldCheck size={20} className="text-blue-300" />
              </h3>
              <p className="text-blue-200 text-sm font-medium mt-1">লিড সফটওয়্যার ইঞ্জিনিয়ার ও ফাউন্ডার</p>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-center text-sm text-gray-600 mb-6 font-medium leading-relaxed">
                আপনার খামার পরিচালনায় যেকোনো প্রযুক্তিগত সাহায্যের জন্য অথবা নতুন ফিচার যুক্ত করতে চাইলে আমার সাথে সরাসরি যোগাযোগ করুন।
              </p>
              
              <a href="https://wa.me/8801410991934" target="_blank" rel="noreferrer" className="flex items-center gap-4 bg-green-50 p-4 rounded-2xl border border-green-100 hover:bg-green-100 hover:border-green-200 transition-all active:scale-95 shadow-sm">
                <div className="bg-gradient-to-br from-green-400 to-green-600 text-white p-3 rounded-xl shadow-md">
                  <MessageCircle size={24} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-green-900">WhatsApp</p>
                  <p className="text-sm text-green-700">সরাসরি মেসেজ দিন</p>
                </div>
                <ExternalLink size={20} className="text-green-500/50" />
              </a>

              <a href="tel:+8801410991934" className="flex items-center gap-4 bg-blue-50 p-4 rounded-2xl border border-blue-100 hover:bg-blue-100 hover:border-blue-200 transition-all active:scale-95 shadow-sm">
                <div className="bg-gradient-to-br from-blue-400 to-blue-600 text-white p-3 rounded-xl shadow-md">
                  <Phone size={24} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-blue-900">কল করুন</p>
                  <p className="text-sm text-blue-700">0141 0991 934</p>
                </div>
                <ExternalLink size={20} className="text-blue-500/50" />
              </a>

              <a href="mailto:sr0632890@gmail.com" className="flex items-center gap-4 bg-orange-50 p-4 rounded-2xl border border-orange-100 hover:bg-orange-100 hover:border-orange-200 transition-all active:scale-95 shadow-sm">
                <div className="bg-gradient-to-br from-orange-400 to-orange-600 text-white p-3 rounded-xl shadow-md">
                  <Mail size={24} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-orange-900">ইমেইল করুন</p>
                  <p className="text-sm text-orange-700">sr0632890@gmail.com</p>
                </div>
                <ExternalLink size={20} className="text-orange-500/50" />
              </a>
            </div>
          </div>
        </div>
      )}

      {showAbout && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-8 text-center animate-in fade-in zoom-in-95 duration-200 relative">
            <button 
              onClick={() => setShowAbout(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors"
            >
              <X size={20} />
            </button>
            <div className="w-20 h-20 bg-green-100 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-inner rotate-3">
              <LogOut size={40} className="text-green-600 -rotate-3" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">ডিজিটাল খামার প্রো</h2>
            <p className="text-gray-600 mb-6 text-sm">বাংলাদেশের সবচেয়ে আধুনিক খামার ব্যবস্থাপনা সফটওয়্যার।</p>
            
            <div className="bg-gray-50 rounded-2xl p-4 text-left space-y-3 mb-6 border border-gray-100">
              <div className="flex justify-between items-center text-sm border-b border-gray-200 pb-2">
                <span className="text-gray-500">সংস্করণ</span>
                <span className="font-bold text-gray-800">১.০.০ প্রো</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-gray-200 pb-2">
                <span className="text-gray-500">লাইসেন্স</span>
                <span className="font-bold text-green-600">আজীবন (Life Time)</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">তৈরি করেছেন</span>
                <span className="font-bold text-blue-600">আবু সুফিয়ান</span>
              </div>
            </div>
            
            <button onClick={() => setShowAbout(false)} className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition-colors">
              ঠিক আছে
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
