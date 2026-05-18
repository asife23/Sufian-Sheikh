import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, offlineSafeDocWrite } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Package, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../components/ConfirmModal';

const BatchSummary = ({ batchId, totalChicks, costPerChick }: { batchId: string, totalChicks: number, costPerChick: number }) => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const [totalSales, setTotalSales] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    
    const fetchSummary = async () => {
      try {
        let tCost = 0;
        let tSales = 0;

        // Fetch Sales
        const salesQ = query(collection(db, 'sales'), where('userId', '==', currentUser.uid), where('batchId', '==', batchId));
        const salesSnap = await getDocs(salesQ);
        salesSnap.forEach(doc => tSales += Number(doc.data().totalAmount || 0));

        // Fetch Expenses
        const expQ = query(collection(db, 'expenses'), where('userId', '==', currentUser.uid), where('batchId', '==', batchId));
        const expSnap = await getDocs(expQ);
        expSnap.forEach(doc => tCost += Number(doc.data().amount || 0));

        // Fetch Feed Cost
        const feedQ = query(collection(db, 'feed_records'), where('userId', '==', currentUser.uid), where('batchId', '==', batchId));
        const feedSnap = await getDocs(feedQ);
        feedSnap.forEach(doc => tCost += Number(doc.data().cost || 0));

        // Fetch Medicine Cost
        const medQ = query(collection(db, 'medicine_records'), where('userId', '==', currentUser.uid), where('batchId', '==', batchId));
        const medSnap = await getDocs(medQ);
        medSnap.forEach(doc => tCost += Number(doc.data().cost || 0));

        // Add original chicks cost
        tCost += (Number(totalChicks || 0) * Number(costPerChick || 0));

        setTotalSales(tSales);
        setTotalCost(tCost);
      } catch (error) {
        console.error("Error fetching summary:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [batchId, currentUser, totalChicks, costPerChick]);

  if (loading) return <div className="text-xs text-gray-400 mt-2">{t('batches.calculating')}</div>;

  const profit = totalSales - totalCost;

  return (
    <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
      <div className="flex justify-between mb-1">
        <span className="text-gray-600">{t('batches.totalSales')}</span>
        <span className="font-bold text-teal-600">৳ {totalSales.toLocaleString()}</span>
      </div>
      <div className="flex justify-between mb-1">
        <span className="text-gray-600">{t('batches.totalCost')}</span>
        <span className="font-bold text-red-600">৳ {totalCost.toLocaleString()}</span>
      </div>
      <div className="border-t border-gray-300 mt-2 pt-2 flex justify-between font-bold text-base">
        <span>{t('batches.net')}{profit >= 0 ? t('batches.profit') : t('batches.loss')}</span>
        <span className={profit >= 0 ? 'text-green-600' : 'text-red-600'}>৳ {Math.abs(profit).toLocaleString()}</span>
      </div>
    </div>
  );
};

export default function Batches() {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLock = useRef(false);
  const [completeBatchId, setCompleteBatchId] = useState<string | null>(null);
  
  // Show form state
  const [showForm, setShowForm] = useState(false);
  
  // Form fields
  const [batchName, setBatchName] = useState('');
  const [farmType, setFarmType] = useState('poultry'); // poultry, cattle, fish
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalChicks, setTotalChicks] = useState('');
  const [costPerChick, setCostPerChick] = useState('');

  useEffect(() => {
    fetchBatches();
  }, [currentUser]);

  const fetchBatches = async () => {
    if (!currentUser) return;
    try {
      const q = query(
        collection(db, 'batches'),
        where('userId', '==', currentUser.uid)
      );
      const snapshot = await getDocs(q);
      const fetchedBatches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBatches(fetchedBatches.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'batches');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (isSubmitting || submitLock.current) return;
    setIsSubmitting(true);
    submitLock.current = true;

    try {
      const newBatch = {
        userId: currentUser.uid,
        batchName,
        farmType,
        startDate,
        totalChicks: Number(totalChicks),
        costPerChick: costPerChick ? Number(costPerChick) : 0,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await offlineSafeDocWrite(addDoc(collection(db, 'batches'), newBatch));
      toast.success(t('batches.addSuccess'));
      setShowForm(false);
      setBatchName('');
      setFarmType('poultry');
      setTotalChicks('');
      setCostPerChick('');
      fetchBatches();
    } catch (error) {
      toast.error(t('batches.addError'));
      handleFirestoreError(error, OperationType.CREATE, 'batches');
    } finally {
      setIsSubmitting(false);
      submitLock.current = false;
    }
  };

  const markCompleted = async () => {
    if(!completeBatchId) return;
    try {
      const batchRef = doc(db, 'batches', completeBatchId);
      await offlineSafeDocWrite(updateDoc(batchRef, { 
        status: 'completed',
        updatedAt: new Date().toISOString()
      }));
      toast.success(t('batches.completeSuccess'));
      setCompleteBatchId(null);
      fetchBatches();
    } catch (error) {
      toast.error(t('batches.updateError'));
      handleFirestoreError(error, OperationType.UPDATE, `batches/${completeBatchId}`);
      setCompleteBatchId(null);
    }
  };

    const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const executeDelete = async () => {
    if (!deleteId) return;
    try {
      await offlineSafeDocWrite(deleteDoc(doc(db, 'batches', deleteId)));
      toast.success(t('batches.delSuccess'), { duration: 3000 });
      fetchBatches();
    } catch (error) {
      toast.error(t('batches.delError'));
      handleFirestoreError(error, OperationType.DELETE, 'batches');
    } finally {
      setDeleteId(null);
    }
  };

  if (loading) return <div>{t('common.loading')}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Package className="text-green-600" /> {t('batches.title')}
        </h2>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700"
        >
          <Plus size={20} />
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-xl shadow border border-green-100 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('batches.batchNameLabel')}</label>
            <input required type="text" value={batchName} onChange={(e) => setBatchName(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-green-500 focus:outline-none" placeholder={t('batches.batchNamePlaceholder')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('batches.farmType')}</label>
            <select required value={farmType} onChange={(e) => setFarmType(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-green-500 focus:outline-none bg-white">
              <option value="poultry">{t('batches.poultry')}</option>
              <option value="cattle">{t('batches.cattle')}</option>
              <option value="fish">{t('batches.fish')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('batches.startDate')}</label>
            <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-green-500 focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('batches.totalChicks')}</label>
              <input required type="number" value={totalChicks} onChange={(e) => setTotalChicks(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-green-500 focus:outline-none" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('batches.costPerChick')}</label>
              <input type="number" value={costPerChick} onChange={(e) => setCostPerChick(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-green-500 focus:outline-none" placeholder="0" />
            </div>
          </div>
          <button disabled={isSubmitting} type="submit" className="w-full bg-green-600 text-white font-bold py-3 rounded-xl mt-2 disabled:bg-gray-400">
            {isSubmitting ? t('common.saving') : t('common.save')}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {batches.map(batch => (
          <div key={batch.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm relative">
            <button
                onClick={() => handleDelete(batch.id)}
                className="absolute top-4 right-4 text-red-500 hover:bg-red-50 p-1 rounded-md"
              >
                <Trash2 size={16} />
            </button>
            <div className="flex justify-between items-start mb-2 pr-8">
              <div>
                <h3 className="font-bold text-lg">{batch.batchName}</h3>
                <p className="text-xs text-gray-500">
                  {batch.farmType === 'cattle' ? t('batches.cattle') : batch.farmType === 'fish' ? t('batches.fish') : t('batches.poultry')} • {t('batches.started')} {new Date(batch.startDate).toLocaleDateString()}
                </p>
              </div>
              <span className={`px-2 py-1 text-xs font-bold rounded-full ${batch.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {batch.status === 'active' ? t('batches.active') : t('batches.completed')}
              </span>
            </div>
            <div className="text-sm bg-gray-50 p-2 rounded my-2">
              <span className="font-semibold text-gray-700">{t('batches.totalChicks')}: </span> {batch.totalChicks} {t('batches.chicksItem')} <br/>
              <span className="font-semibold text-gray-700">{t('batches.costPerChick')}: </span> ৳ {batch.costPerChick} {t('batches.currencyPerItem')}
            </div>
            {batch.status === 'active' && (
               <div className="mt-3 text-right">
                 <button onClick={() => setCompleteBatchId(batch.id)} className="text-sm border border-red-500 text-red-600 px-3 py-1 rounded hover:bg-red-50">
                    {t('batches.markComplete')}
                 </button>
               </div>
            )}
            {batch.status === 'completed' && (
               <BatchSummary batchId={batch.id} totalChicks={batch.totalChicks} costPerChick={batch.costPerChick} />
            )}
          </div>
        ))}
        
        {batches.length === 0 && !showForm && (
          <div className="text-center text-gray-500 py-10 bg-white rounded-xl border border-dashed border-gray-300">
            {t('batches.noBatches')}
          </div>
        )}
      </div>

      <ConfirmModal 
        isOpen={!!completeBatchId}
        title={t('batches.confirmCompleteTitle')}
        message={t('batches.confirmCompleteMsg')}
        onConfirm={markCompleted}
        onCancel={() => setCompleteBatchId(null)}
      />
    
      <ConfirmModal 
        isOpen={!!deleteId}
        title={t('common.confirmDelete')}
        message={t('common.confirmDeleteMsg')}
        onConfirm={executeDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
