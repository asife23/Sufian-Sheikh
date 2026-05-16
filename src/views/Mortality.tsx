import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../components/ConfirmModal';

export default function Mortality() {
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
  const [count, setCount] = useState('');
  const [cause, setCause] = useState('অজ্ঞাত');

  useEffect(() => {
    fetchInitialData();
  }, [currentUser]);

  const fetchInitialData = async () => {
    if (!currentUser) return;
    try {
      const batchesQuery = query(collection(db, 'batches'), where('userId', '==', currentUser.uid), where('status', '==', 'active'));
      const batchSnap = await getDocs(batchesQuery);
      const batches = batchSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActiveBatches(batches);
      if(batches.length > 0) setBatchId(batches[0].id);

      const queryMortality = query(collection(db, 'mortality'), where('userId', '==', currentUser.uid));
      const expSnap = await getDocs(queryMortality);
      const fetchedRecords = expSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecords(fetchedRecords.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'mortality');
    } finally {
      setLoading(false);
    }
  };

    const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const executeDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'mortality', deleteId));
      toast.success('মুছে ফেলা হয়েছে!', { duration: 3000 });
      fetchInitialData();
    } catch (error) {
      toast.error('মুছে ফেলতে সমস্যা হয়েছে।');
      handleFirestoreError(error, OperationType.DELETE, 'mortality');
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
        count: Number(count),
        cause,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'mortality'), newRecord);
      toast.success('মৃত্যু এন্ট্রি যোগ করা হয়েছে!');
      setShowForm(false);
      setCount('');
      fetchInitialData();
    } catch (error) {
      toast.error('যোগ করতে সমস্যা হয়েছে।');
      handleFirestoreError(error, OperationType.CREATE, 'mortality');
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
          <AlertTriangle className="text-red-600" /> মৃত্যু এন্ট্রি
        </h2>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-red-600 text-white p-2 rounded-lg hover:bg-red-700"
        >
          <Plus size={20} />
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-xl shadow border border-red-100 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ব্যাচ</label>
              <select required value={batchId} onChange={(e) => setBatchId(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-red-500">
                <option value="">নির্বাচন করুন...</option>
                {activeBatches.map(b => <option key={b.id} value={b.id}>{b.batchName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">তারিখ</label>
              <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-red-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">মৃতের সংখ্যা</label>
              <input required type="number" value={count} onChange={(e) => setCount(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-red-500" placeholder="সংখ্যা" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">কারণ</label>
              <input required type="text" value={cause} onChange={(e) => setCause(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-red-500" placeholder="কারণ" />
            </div>
          </div>
          <button disabled={isSubmitting} type="submit" className="w-full bg-red-600 text-white font-bold py-3 rounded-xl mt-2 disabled:bg-gray-400">
            {isSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {records.map(record => {
          return (
            <div key={record.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-800">{new Date(record.date).toLocaleDateString()}</h3>
                <p className="text-xs text-gray-500">কারণ: {record.cause}</p>
              </div>
              <div className="text-right flex flex-col items-end">
                <span className="font-bold text-red-600 text-lg">{record.count} টি</span>
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
