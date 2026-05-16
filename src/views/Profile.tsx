import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { User, LogOut, CheckCircle, Settings, HelpCircle, Info, Globe, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLock = useRef(false);
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [farmName, setFarmName] = useState('');
  const [language, setLanguage] = useState('bn');

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
        name,
        phone,
        farmName,
        language,
        updatedAt: new Date().toISOString()
      };

      if (docSnap.exists()) {
        await updateDoc(userRef, payload);
      } else {
        await setDoc(userRef, {
          userId: currentUser.uid,
          ...payload,
          createdAt: new Date().toISOString()
        });
      }
      
      toast.success('প্রোফাইল আপডেট হয়েছে!');
    } catch (error) {
      toast.error('আপডেট করতে সমস্যা হয়েছে।');
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
      toast.error('লগআউট করতে সমস্যা হয়েছে, নেভিগেট করা হচ্ছে...');
      navigate('/login');
    }
  };

  if (loading) return <div className="text-center py-10">লোড হচ্ছে...</div>;

  return (
    <div className="space-y-4 pb-4">
      <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Settings className="text-blue-500" /> সেটিংস ও প্রোফাইল
        </h2>
        <button 
          onClick={handleLogout}
          className="text-red-500 hover:bg-red-50 p-2 rounded-lg flex items-center gap-1 text-sm font-semibold"
        >
          <LogOut size={18} /> লগআউট 
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
        <h3 className="font-bold text-lg text-gray-800">{name || 'নাম সেট করা নেই'}</h3>
        <p className="text-sm text-gray-500">{currentUser?.email}</p>
      </div>

      <form onSubmit={handleSave} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <h3 className="font-bold text-gray-800 border-b pb-2">ব্যক্তিগত তথ্য</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">আপনার নাম</label>
          <input 
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500" 
            placeholder="আপনার সম্পূর্ণ নাম" 
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">মোবাইল নাম্বার</label>
          <input 
            type="tel" 
            value={phone} 
            onChange={(e) => setPhone(e.target.value)} 
            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500" 
            placeholder="017xxxxxxxx" 
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">খামারের নাম</label>
          <input 
            type="text" 
            value={farmName} 
            onChange={(e) => setFarmName(e.target.value)} 
            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500" 
            placeholder="খামারের নাম (ঐচ্ছিক)" 
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
             <Globe size={16} className="text-gray-500"/> অ্যাপের ভাষা
          </label>
          <select 
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="bn">বাংলা</option>
            <option value="en">English (Coming Soon)</option>
          </select>
        </div>

        <button disabled={isSubmitting} type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl mt-4 flex items-center justify-center gap-2 disabled:bg-gray-400">
          <CheckCircle size={20} /> {isSubmitting ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
        </button>
      </form>

      {/* Support & About Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
        <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors" onClick={() => toast('ইমেইল: sr0632890@gmail.com\nমোবাইল: 01410991934\nডেভেলপার: আবু সুফিয়ান', { duration: 5000 })}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
              <HelpCircle size={18} />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-800 text-sm">সাহায্য ও সাপোর্ট</p>
              <p className="text-xs text-gray-500">ডেভেলপারের সাথে যোগাযোগ করুন</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>

        <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors" onClick={() => toast('ডিজিটাল খামার প্রো\nডেভেলপার: আবু সুফিয়ান\nসংস্করণ ১.০.০', { duration: 5000 })}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
              <Info size={18} />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-800 text-sm">অ্যাপ সম্পর্কে</p>
              <p className="text-xs text-gray-500">ডেভেলপার: আবু সুফিয়ান</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>
      </div>

    </div>
  );
}
