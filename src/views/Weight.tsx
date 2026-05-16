import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Scale, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../components/ConfirmModal';

export default function Weight() {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { currentUser } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [activeBatches, setActiveBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLock = useRef(false);
  
  const [showForm, setShowForm] = useState(false);
  const [batchId, setBatchId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [ageDays, setAgeDays] = useState('');
  const [averageWeight, setAverageWeight] = useState('');
  const [totalBirdsSampled, setTotalBirdsSampled] = useState('10');

  useEffect(() => {
    fetchInitialData();
  }, [currentUser]);

  const fetchInitialData = async () => {
    if (!currentUser) return;
    try {
      const batchesQuery = query(collection(db, 'batches'), where('userId', '==', currentUser.uid), where('status', '==', 'active'));
      const batchSnap = await getDocs(batchesQuery);
      const batches = batchSnap.docs.map(bDoc => ({ id: bDoc.id, ...bDoc.data() }));
      setActiveBatches(batches);
      if(batches.length > 0) setBatchId(batches[0].id);

      const weightQuery = query(collection(db, 'weight_records'), where('userId', '==', currentUser.uid));
      const weightSnap = await getDocs(weightQuery);
      const fetchedRecords = weightSnap.docs.map(wDoc => ({ id: wDoc.id, ...wDoc.data() }));
      setRecords(fetchedRecords.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'weight_records');
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (batchStart: string, recDate: string) => {
    const start = new Date(batchStart);
    const current = new Date(recDate);
    const diffTime = Math.abs(current.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleBatchChange = (selectedBatchId: string) => {
    setBatchId(selectedBatchId);
    const batch = activeBatches.find(b => b.id === selectedBatchId);
    if (batch && batch.startDate) {
      setAgeDays(calculateAge(batch.startDate, date).toString());
    } else {
      setAgeDays('');
    }
  };

  const handleDateChange = (selectedDate: string) => {
    setDate(selectedDate);
    const batch = activeBatches.find(b => b.id === batchId);
    if (batch && batch.startDate) {
      setAgeDays(calculateAge(batch.startDate, selectedDate).toString());
    }
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const executeDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'weight_records', deleteId));
      toast.success('মুছে ফেলা হয়েছে!', { duration: 3000 });
      fetchInitialData();
    } catch (error) {
      toast.error('মুছে ফেলতে সমস্যা হয়েছে।');
      handleFirestoreError(error, OperationType.DELETE, 'weight_records');
    } finally {
      setDeleteId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !batchId) return toast.error('ব্যাচ নির্বাচন করুন');
    if (isSubmitting || submitLock.current) return;

    setIsSubmitting(true);
    submitLock.current = true;

    try {
      const newRecord = {
        userId: currentUser.uid,
        batchId,
        date,
        ageDays: Number(ageDays),
        averageWeight: Number(averageWeight),
        totalBirdsSampled: Number(totalBirdsSampled),
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'weight_records'), newRecord);
      
      toast.success('ওজন রেকর্ড যোগ করা হয়েছে!');
      setShowForm(false);
      setAverageWeight('');
      fetchInitialData();
    } catch (error) {
      toast.error('যোগ করতে সমস্যা হয়েছে।');
      handleFirestoreError(error, OperationType.CREATE, 'weight_records');
    } finally {
      setIsSubmitting(false);
      submitLock.current = false;
    }
  };

  if (loading) return <div>লোড হচ্ছে...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Scale className="text-yellow-600" /> ওজন পরিমাপ
        </h2>
        <button 
          onClick={() => {
            setShowForm(!showForm);
            if (!showForm && batchId) handleBatchChange(batchId);
          }}
          className="bg-yellow-500 text-white p-2 rounded-lg hover:bg-yellow-600"
        >
          <Plus size={20} />
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-xl shadow border border-yellow-100 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ব্যাচ</label>
            <select required value={batchId} onChange={(e) => handleBatchChange(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-yellow-500">
              <option value="">নির্বাচন করুন...</option>
              {activeBatches.map(b => <option key={b.id} value={b.id}>{b.batchName}</option>)}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">তারিখ</label>
              <input required type="date" value={date} onChange={(e) => handleDateChange(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-yellow-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">বয়স (দিন)</label>
              <input required type="number" value={ageDays} onChange={(e) => setAgeDays(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-yellow-500" placeholder="দিন" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">গড় ওজন (গ্রাম)</label>
              <input required type="number" value={averageWeight} step="any" onChange={(e) => setAverageWeight(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-yellow-500" placeholder="যেমন: 1200" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">নমুনা সংখ্যা</label>
              <input required type="number" value={totalBirdsSampled} onChange={(e) => setTotalBirdsSampled(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-yellow-500" />
            </div>
          </div>

          <button disabled={isSubmitting} type="submit" className="w-full bg-yellow-500 text-white font-bold py-3 rounded-xl mt-2 disabled:bg-gray-400">
            {isSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {records.length === 0 ? (
           <div className="text-center text-gray-500 py-6 bg-white rounded-xl border border-dashed border-gray-300">
             কোনো রেকর্ড পাওয়া যায়নি।
           </div>
        ) : records.map(record => {
          const batchName = activeBatches.find(b => b.id === record.batchId)?.batchName || 'Unknown Batch';
          return (
            <div key={record.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-start justify-between">
              <div>
                <h3 className="font-bold text-gray-800">{batchName}</h3>
                <p className="text-xs text-gray-500">{new Date(record.date).toLocaleDateString()} • বয়স: <span className="font-semibold text-gray-700">{record.ageDays} দিন</span></p>
                <div className="mt-1 text-sm bg-yellow-50 text-yellow-800 px-2 py-1 rounded inline-block">
                  নমুনা: {record.totalBirdsSampled} টি
                </div>
              </div>
              <div className="text-right flex flex-col items-end">
                <span className="font-bold text-yellow-600 text-lg">{record.averageWeight} গ্রাম</span>
                <span className="text-[10px] text-gray-400 mt-1">গড় ওজন</span>
                <button onClick={() => handleDelete(record.id)} className="text-red-500 hover:bg-red-50 p-1 rounded-md mt-1 inline-block">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    
      <ConfirmModal 
        isOpen={!!deleteId}
        title="মুছে ফেলার নিশ্চিতকরণ"
        message="আপনি কি নিশ্চিত যে আপনি এটি মুছে ফেলতে চান?"
        onConfirm={executeDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
