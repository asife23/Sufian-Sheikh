import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { TrendingUp, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../components/ConfirmModal';

export default function Expenses() {
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
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('বিদ্যুৎ বিল');
  const [details, setDetails] = useState('');
  const [personName, setPersonName] = useState('');
  const [personPhone, setPersonPhone] = useState('');
  const [amountPaid, setAmountPaid] = useState('');

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

      const expQuery = query(collection(db, 'expenses'), where('userId', '==', currentUser.uid));
      const expSnap = await getDocs(expQuery);
      const fetchedRecords = expSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecords(fetchedRecords.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'expenses');
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
      await deleteDoc(doc(db, 'expenses', deleteId));
      toast.success('মুছে ফেলা হয়েছে!', { duration: 3000 });
      fetchInitialData();
    } catch (error) {
      toast.error('মুছে ফেলতে সমস্যা হয়েছে।');
      handleFirestoreError(error, OperationType.DELETE, 'expenses');
    } finally {
      setDeleteId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !batchId) return toast.error('ব্যাচ নির্বাচন করুন');
    if (isSubmitting || submitLock.current) return;

    const totalAmountVal = Number(amount);
    const paidValRaw = amountPaid ? Number(amountPaid) : totalAmountVal;
    const paidVal = Math.min(paidValRaw, totalAmountVal);

    if (paidVal < totalAmountVal && !personName.trim()) {
      return toast.error('বাকি থাকলে প্রাপকের (যাকে দিবেন) নাম লিখতে হবে!');
    }

    setIsSubmitting(true);
    submitLock.current = true;

    try {
      const newRecord = {
        userId: currentUser.uid,
        batchId,
        date,
        category,
        amount: totalAmountVal,
        amountPaid: paidVal,
        personName,
        details,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'expenses'), newRecord);

      if (paidVal < totalAmountVal) {
        const batchName = activeBatches.find(b => b.id === batchId)?.batchName || 'Unknown Batch';
        const dueRecord = {
          userId: currentUser.uid,
          personName,
          phone: personPhone,
          type: 'payable',
          amount: totalAmountVal,
          totalPaid: paidVal,
          details: `${batchName} এর ${category} খরচ: ${details || ''}`,
          recordDate: date,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'dues'), dueRecord);
      }

      toast.success('খরচ যোগ করা হয়েছে!');
      setShowForm(false);
      setAmount('');
      setAmountPaid('');
      setDetails('');
      setPersonName('');
      setPersonPhone('');
      fetchInitialData();
    } catch (error) {
      toast.error('যোগ করতে সমস্যা হয়েছে।');
      handleFirestoreError(error, OperationType.CREATE, 'expenses');
    } finally {
      setIsSubmitting(false);
      submitLock.current = false;
    }
  };

  if (loading) return <div>লোড হচ্ছে...</div>;

  const currentTotalAmount = Number(amount) || 0;
  const currentPaidRaw = amountPaid !== '' ? Number(amountPaid) : currentTotalAmount;
  const currentDue = Math.max(0, currentTotalAmount - currentPaidRaw);
  const currentReturnAmount = amountPaid !== '' ? Math.max(0, currentPaidRaw - currentTotalAmount) : 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <TrendingUp className="text-purple-600" /> খরচ ব্যবস্থাপনা
        </h2>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-purple-600 text-white p-2 rounded-lg hover:bg-purple-700"
        >
          <Plus size={20} />
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-xl shadow border border-purple-100 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ব্যাচ</label>
              <select required value={batchId} onChange={(e) => setBatchId(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500">
                <option value="">নির্বাচন করুন...</option>
                {activeBatches.map(b => <option key={b.id} value={b.id}>{b.batchName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">তারিখ</label>
              <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">খরচের খাত</label>
            <select required value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500">
              <option value="বিদ্যুৎ বিল">বিদ্যুৎ বিল</option>
              <option value="শ্রমিক">শ্রমিক</option>
              <option value="পরিবহন">পরিবহন</option>
              <option value="তুষ/কাঠের গুঁড়া">তুষ/কাঠের গুঁড়া</option>
              <option value="অন্যান্য">অন্যান্য</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">কার কাছে দিয়েছেন? (নাম)</label>
              <input type="text" value={personName} onChange={(e) => setPersonName(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500" placeholder="যেমন: রহমতের দোকান" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">মোবাইল নম্বর</label>
              <input type="tel" value={personPhone} onChange={(e) => setPersonPhone(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500" placeholder="017xxxxxxxx" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">মোট টাকার পরিমাণ (৳)</label>
              <input required type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500" placeholder="মোট পরিমাণ" />
            </div>
            <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">জমা/পরিশোধ (৳)</label>
               <input type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500" placeholder={`ডিফল্ট: ৳ ${currentTotalAmount}`} />
            </div>
          </div>
          {currentDue > 0 && <p className="text-red-500 text-sm font-semibold">বাকি: ৳ {currentDue} (স্বয়ংক্রিয়ভাবে বকেয়া খাতায় যোগ হবে)</p>}
          {currentReturnAmount > 0 && <p className="text-green-600 text-sm font-semibold">ফেরত পাবেন: ৳ {currentReturnAmount}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">খরচের বিবরণ (ঐচ্ছিক)</label>
            <input type="text" value={details} onChange={(e) => setDetails(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500" placeholder="কী জন্য খরচ হলো?" />
          </div>
          <button disabled={isSubmitting} type="submit" className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl mt-2 disabled:bg-gray-400">
            {isSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {records.map(record => {
          const rPaid = record.amountPaid !== undefined ? record.amountPaid : record.amount;
          const rDue = record.amount - rPaid;
          return (
            <div key={record.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-start justify-between">
              <div>
                <h3 className="font-bold text-gray-800">{record.category}</h3>
                <p className="text-xs text-gray-500">{new Date(record.date).toLocaleDateString()}</p>
                {record.personName && <p className="text-xs font-semibold text-gray-600 mt-0.5">প্রাপক: {record.personName}</p>}
                {record.details && <p className="text-sm text-gray-600 mt-1">{record.details}</p>}
              </div>
              <div className="text-right flex flex-col items-end">
                <span className="font-bold text-purple-600 text-lg">৳ {record.amount}</span>
                {rDue > 0 && <span className="text-xs font-semibold text-red-500 outline outline-1 outline-red-200 px-1 rounded mt-1">বাকি: ৳ {rDue}</span>}
                {rDue === 0 && <span className="text-xs font-semibold text-green-600 outline outline-1 outline-green-200 px-1 rounded mt-1">পরিশোধিত</span>}
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
