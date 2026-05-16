import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { ShieldPlus, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../components/ConfirmModal';

export default function Medicine() {
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
  const [medicineName, setMedicineName] = useState('');
  const [type, setType] = useState('medicine');
  const [cost, setCost] = useState('');
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

      const medQuery = query(collection(db, 'medicine_records'), where('userId', '==', currentUser.uid));
      const medSnap = await getDocs(medQuery);
      const fetchedRecords = medSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecords(fetchedRecords.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'medicine_records');
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
      await deleteDoc(doc(db, 'medicine_records', deleteId));
      toast.success('মুছে ফেলা হয়েছে!', { duration: 3000 });
      fetchInitialData();
    } catch (error) {
      toast.error('মুছে ফেলতে সমস্যা হয়েছে।');
      handleFirestoreError(error, OperationType.DELETE, 'medicine_records');
    } finally {
      setDeleteId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !batchId) return toast.error('ব্যাচ নির্বাচন করুন');
    if (isSubmitting || submitLock.current) return;

    const totalAmountVal = Number(cost);
    const paidValRaw = amountPaid ? Number(amountPaid) : totalAmountVal;
    const paidVal = Math.min(paidValRaw, totalAmountVal);

    if (paidVal < totalAmountVal && !personName.trim()) {
      return toast.error('বাকি থাকলে যাকে দিবেন তার নাম লিখতে হবে!');
    }

    setIsSubmitting(true);
    submitLock.current = true;

    try {
      const newRecord = {
        userId: currentUser.uid,
        batchId,
        date,
        medicineName,
        type,
        cost: totalAmountVal,
        amountPaid: paidVal,
        personName,
        details,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'medicine_records'), newRecord);

      if (paidVal < totalAmountVal) {
        const batchName = activeBatches.find(b => b.id === batchId)?.batchName || 'Unknown Batch';
        const typeName = type === 'vaccine' ? 'ভ্যাকসিন' : 'ঔষধ';
        const dueRecord = {
          userId: currentUser.uid,
          personName,
          phone: personPhone,
          type: 'payable',
          amount: totalAmountVal,
          totalPaid: paidVal,
          details: `${batchName} এর ${typeName}: ${medicineName} ${details ? '('+details+')' : ''}`,
          recordDate: date,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'dues'), dueRecord);
      }

      toast.success('রেকর্ড যোগ করা হয়েছে!');
      setShowForm(false);
      setMedicineName('');
      setCost('');
      setAmountPaid('');
      setDetails('');
      setPersonName('');
      setPersonPhone('');
      fetchInitialData();
    } catch (error) {
      toast.error('যোগ করতে সমস্যা হয়েছে।');
      handleFirestoreError(error, OperationType.CREATE, 'medicine_records');
    } finally {
      setIsSubmitting(false);
      submitLock.current = false;
    }
  };

  if (loading) return <div>লোড হচ্ছে...</div>;

  const currentTotalAmount = Number(cost) || 0;
  const currentPaidRaw = amountPaid !== '' ? Number(amountPaid) : currentTotalAmount;
  const currentDue = Math.max(0, currentTotalAmount - currentPaidRaw);
  const currentReturnAmount = amountPaid !== '' ? Math.max(0, currentPaidRaw - currentTotalAmount) : 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <ShieldPlus className="text-blue-500" /> ঔষধ এবং ভ্যাকসিন
        </h2>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600"
        >
          <Plus size={20} />
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-xl shadow border border-blue-100 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ব্যাচ</label>
            <select required value={batchId} onChange={(e) => setBatchId(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500">
              <option value="">নির্বাচন করুন...</option>
              {activeBatches.map(b => <option key={b.id} value={b.id}>{b.batchName}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">তারিখ</label>
              <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ধরন</label>
              <select required value={type} onChange={(e) => setType(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500">
                <option value="medicine">ঔষধ (Medicine)</option>
                <option value="vaccine">ভ্যাকসিন (Vaccine)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">নাম/বিবরণ</label>
            <input required type="text" value={medicineName} onChange={(e) => setMedicineName(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500" placeholder="ঔষধ বা ভ্যাকসিনের নাম" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">দোকানের নাম / প্রাপক</label>
              <input type="text" value={personName} onChange={(e) => setPersonName(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500" placeholder="কোথা থেকে কেনা?" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">মোবাইল নম্বর</label>
              <input type="tel" value={personPhone} onChange={(e) => setPersonPhone(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500" placeholder="017xxxxxxxx" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">মোট দাম (৳)</label>
              <input required type="number" value={cost} onChange={(e) => setCost(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500" placeholder="সর্বমোট দাম" />
            </div>
            <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">জমা/পরিশোধ (৳)</label>
               <input type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500" placeholder={`ডিফল্ট: ৳ ${currentTotalAmount}`} />
            </div>
          </div>
          {currentDue > 0 && <p className="text-red-500 text-sm font-semibold">বাকি: ৳ {currentDue} (স্বয়ংক্রিয়ভাবে বকেয়া খাতায় যোগ হবে)</p>}
          {currentReturnAmount > 0 && <p className="text-green-600 text-sm font-semibold">ফেরত পাবেন: ৳ {currentReturnAmount}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">বিবরণ/নোট (ঐচ্ছিক)</label>
            <input type="text" value={details} onChange={(e) => setDetails(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500" placeholder="কী রোগের জন্য?" />
          </div>
          <button disabled={isSubmitting} type="submit" className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl mt-2 disabled:bg-gray-400">
            {isSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {records.map(record => {
          const batchName = activeBatches.find(b => b.id === record.batchId)?.batchName || 'Unknown Batch';
          const rPaid = record.amountPaid !== undefined ? record.amountPaid : record.cost;
          const rDue = record.cost - rPaid;
          return (
            <div key={record.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-start justify-between">
              <div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold mb-1 inline-block ${record.type === 'vaccine' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
                  {record.type === 'vaccine' ? 'ভ্যাকসিন' : 'ঔষধ'}
                </span>
                <h3 className="font-bold text-gray-800">{record.medicineName}</h3>
                <p className="text-xs text-gray-500">{new Date(record.date).toLocaleDateString()} - {batchName}</p>
                {record.personName && <p className="text-xs font-semibold text-gray-600 mt-0.5">দোকান: {record.personName}</p>}
                {record.details && <p className="text-sm text-gray-600 mt-1">{record.details}</p>}
              </div>
              <div className="text-right flex flex-col items-end">
                <span className="font-bold text-blue-600 text-lg">৳ {record.cost}</span>
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
