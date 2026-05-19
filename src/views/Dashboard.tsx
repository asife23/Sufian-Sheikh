import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, doc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, fastGetDocs } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Package, TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const [activeBatch, setActiveBatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [totalMortality, setTotalMortality] = useState<number>(0);
  const [profileData, setProfileData] = useState<any>(null);

  useEffect(() => {
    fetchActiveBatch();
    
    if (currentUser) {
      const unsub = onSnapshot(doc(db, 'users', currentUser.uid), (docObj) => {
        if (docObj.exists()) {
          setProfileData(docObj.data());
        }
      });
      return () => unsub();
    }
  }, [currentUser]);

  const fetchActiveBatch = async () => {
    if (!currentUser) return;
    try {
      const q = query(
        collection(db, 'batches'),
        where('userId', '==', currentUser.uid),
        where('status', '==', 'active')
      );
      const snapshot = await fastGetDocs(q);
      if (!snapshot.empty) {
        const batchData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        setActiveBatch(batchData);
        fetchMortality(batchData.id);
      } else {
        setActiveBatch(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'batches');
    } finally {
      setLoading(false);
    }
  };

  const fetchMortality = async (batchId: string) => {
    if (!currentUser) return;
    try {
      const q = query(
        collection(db, 'mortality'),
        where('userId', '==', currentUser.uid),
        where('batchId', '==', batchId)
      );
      const snapshot = await fastGetDocs(q);
      let count = 0;
      snapshot.forEach(doc => {
        count += doc.data().count;
      });
      setTotalMortality(count);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'mortality');
    }
  };

  const calculateAge = (startDate: string) => {
    const start = new Date(startDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  if (loading) return <div className="p-4 text-center">{t('common.loading')}</div>;

  return (
    <div className="space-y-4">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-4 text-white shadow text-center">
        <h2 className="text-lg font-medium opacity-90">{t('dashboard.greeting')}</h2>
        <h3 className="text-xl font-bold">{profileData?.name || currentUser?.displayName || t('dashboard.khamari')}</h3>
      </div>

      {activeBatch ? (
        <div className="bg-white rounded-xl p-4 shadow border border-green-100">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-gray-800 flex items-center gap-2">
              <Package size={20} className="text-green-600" />
              {t('dashboard.activeBatches')}: {activeBatch.batchName}
            </h4>
          </div>
          
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">{t('dashboard.totalBirds')}</p>
              <p className="text-lg font-bold text-blue-700">{activeBatch.totalChicks}</p>
            </div>
            <div className="bg-red-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">{t('dashboard.totalMortality')}</p>
              <p className="text-lg font-bold text-red-700">{totalMortality}</p>
            </div>
            <div className="bg-orange-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">{t('dashboard.age')}</p>
              <p className="text-lg font-bold text-orange-700">{calculateAge(activeBatch.startDate)} {t('dashboard.days')}</p>
            </div>
          </div>

          <Link to={`/batches`} className="w-full flex items-center justify-center gap-2 bg-green-50 text-green-700 py-2 rounded-lg font-medium hover:bg-green-100 transition-colors">
            {t('dashboard.viewDetails')} <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl p-6 shadow text-center border-dashed border-2 border-green-200">
          <div className="bg-green-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
            <Package size={32} className="text-green-500" />
          </div>
          <h4 className="font-bold text-gray-800 mb-2">{t('dashboard.noBatches')}</h4>
          <p className="text-sm text-gray-500 mb-4">{t('dashboard.noBatchesSub')}</p>
          <Link to="/batches" className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 inline-block">
            {t('dashboard.createBatch')}
          </Link>
        </div>
      )}

      {/* Quick Actions Grid */}
      <h4 className="font-bold text-gray-800 mt-6 mb-3">{t('dashboard.quickActions')}</h4>
      <div className="grid grid-cols-3 gap-3">
        <Link to="/feed" className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:border-green-300">
          <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
          </div>
          <span className="text-[10px] sm:text-xs font-medium text-gray-700 text-center">{t('dashboard.feed')}</span>
        </Link>
        <Link to="/medicine" className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:border-green-300">
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          </div>
          <span className="text-[10px] sm:text-xs font-medium text-gray-700 text-center">{t('dashboard.medicine')}</span>
        </Link>
        <Link to="/mortality" className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:border-green-300">
          <div className="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
             <AlertTriangle size={20} />
          </div>
          <span className="text-[10px] sm:text-xs font-medium text-gray-700 text-center">{t('dashboard.mortality')}</span>
        </Link>
        <Link to="/expenses" className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:border-green-300">
          <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center">
             <TrendingUp size={20} />
          </div>
          <span className="text-[10px] sm:text-xs font-medium text-gray-700 text-center">{t('dashboard.expenses')}</span>
        </Link>
        <Link to="/sales" className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:border-green-300">
          <div className="w-10 h-10 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
          </div>
          <span className="text-[10px] sm:text-xs font-medium text-gray-700 text-center">{t('dashboard.sales')}</span>
        </Link>
        <Link to="/dues" className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:border-green-300">
          <div className="w-10 h-10 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
          <span className="text-[10px] sm:text-xs font-medium text-gray-700 text-center">{t('dashboard.dues')}</span>
        </Link>
        <Link to="/reports" className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:border-green-300">
          <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          </div>
          <span className="text-[10px] sm:text-xs font-medium text-gray-700 text-center">{t('dashboard.reports')}</span>
        </Link>
        <Link to="/guidelines" className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:border-green-300 relative overflow-hidden">
          <div className="w-10 h-10 bg-gradient-to-tr from-green-400 to-emerald-600 text-white rounded-full flex items-center justify-center shadow-inner">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <span className="text-[10px] sm:text-xs font-medium text-gray-700 text-center">{t('dashboard.guidelines')}</span>
          <div className="absolute -top-3 -right-3 w-8 h-8 bg-pink-500 transform rotate-45 flex items-end justify-center"><span className="text-[6px] text-white font-bold mb-1">PRO</span></div>
        </Link>
      </div>
    </div>
  );
}
