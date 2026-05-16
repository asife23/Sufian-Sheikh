import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { ShoppingCart, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../components/ConfirmModal';

export default function Sales() {
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
  const [saleType, setSaleType] = useState('weight'); // 'weight' or 'quantity'
  const [totalWeightKg, setTotalWeightKg] = useState('');
  const [pricePerKg, setPricePerKg] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [quantity, setQuantity] = useState('');
  const [pricePerPiece, setPricePerPiece] = useState('');
  const [amountPaid, setAmountPaid] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, [currentUser]);

  const fetchInitialData = async () => {
    if (!currentUser) return;
    try {
      const batchesQuery = query(collection(db, 'batches'), where('userId', '==', currentUser.uid));
      const batchSnap = await getDocs(batchesQuery);
      const batches = batchSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActiveBatches(batches);
      if(batches.length > 0) {
        setBatchId(batches[0].id);
        if (batches[0].farmType === 'cattle') {
          setSaleType('quantity');
        } else {
          setSaleType('weight');
        }
      }

      const salesQuery = query(collection(db, 'sales'), where('userId', '==', currentUser.uid));
      const salesSnap = await getDocs(salesQuery);
      const fetchedRecords = salesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecords(fetchedRecords.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'sales');
    } finally {
      setLoading(false);
    }
  };

    const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const handleBatchChange = (selectedBatchId: string) => {
    setBatchId(selectedBatchId);
    const batch = activeBatches.find(b => b.id === selectedBatchId);
    if (batch) {
      if (batch.farmType === 'cattle') {
        setSaleType('quantity');
      } else {
        setSaleType('weight');
      }
    } else {
      setSaleType('weight');
    }
  };

  const executeDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'sales', deleteId));
      toast.success('মুছে ফেলা হয়েছে!', { duration: 3000 });
      fetchInitialData();
    } catch (error) {
      toast.error('মুছে ফেলতে সমস্যা হয়েছে।');
      handleFirestoreError(error, OperationType.DELETE, 'sales');
    } finally {
      setDeleteId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !batchId) return toast.error('ব্যাচ নির্বাচন করুন');
    if (isSubmitting || submitLock.current) return;

    let totalAmountVal = 0;
    if (saleType === 'weight') {
      totalAmountVal = Number(totalWeightKg) * Number(pricePerKg);
    } else {
      totalAmountVal = Number(quantity) * Number(pricePerPiece);
    }

    const paidValRaw = amountPaid ? Number(amountPaid) : totalAmountVal;
    const paidVal = Math.min(paidValRaw, totalAmountVal);

    if (paidVal < totalAmountVal && !buyerName.trim()) {
      return toast.error('বাকি থাকলে ক্রেতার নাম লিখতে হবে!');
    }

    setIsSubmitting(true);
    submitLock.current = true;

    try {
      const newRecord = {
        userId: currentUser.uid,
        batchId,
        date,
        saleType,
        totalWeightKg: saleType === 'weight' ? Number(totalWeightKg) : 0,
        pricePerKg: saleType === 'weight' ? Number(pricePerKg) : 0,
        quantity: saleType === 'weight' ? (quantity ? Number(quantity) : 0) : Number(quantity),
        pricePerPiece: saleType === 'quantity' ? Number(pricePerPiece) : 0,
        totalAmount: totalAmountVal,
        amountPaid: paidVal,
        buyerName,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'sales'), newRecord);

      if (paidVal < totalAmountVal) {
        const batchName = activeBatches.find(b => b.id === batchId)?.batchName || 'Unknown Batch';
        const dueRecord = {
          userId: currentUser.uid,
          personName: buyerName,
          phone: buyerPhone,
          type: 'receivable',
          amount: totalAmountVal,
          totalPaid: paidVal,
          details: `${batchName} এর বিক্রয়`,
          recordDate: date,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'dues'), dueRecord);
      }

      toast.success('বিক্রয়ের হিসাব যোগ করা হয়েছে!');
      setShowForm(false);
      setTotalWeightKg('');
      setPricePerKg('');
      setQuantity('');
      setPricePerPiece('');
      setAmountPaid('');
      setBuyerName('');
      setBuyerPhone('');
      fetchInitialData();
    } catch (error) {
      toast.error('যোগ করতে সমস্যা হয়েছে।');
      handleFirestoreError(error, OperationType.CREATE, 'sales');
    } finally {
      setIsSubmitting(false);
      submitLock.current = false;
    }
  };

  if (loading) return <div>লোড হচ্ছে...</div>;

  const currentTotalAmount = saleType === 'weight' 
    ? (Number(totalWeightKg) * Number(pricePerKg)) || 0 
    : (Number(quantity) * Number(pricePerPiece)) || 0;
  const currentPaidRaw = amountPaid ? Number(amountPaid) : currentTotalAmount;
  const currentDue = Math.max(0, currentTotalAmount - currentPaidRaw);
  const currentReturnAmount = amountPaid ? Math.max(0, currentPaidRaw - currentTotalAmount) : 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <ShoppingCart className="text-teal-600" /> বিক্রয়
        </h2>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-teal-600 text-white p-2 rounded-lg hover:bg-teal-700"
        >
          <Plus size={20} />
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-xl shadow border border-teal-100 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ব্যাচ</label>
            <select required value={batchId} onChange={(e) => handleBatchChange(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500">
              <option value="">নির্বাচন করুন...</option>
              {activeBatches.map(b => <option key={b.id} value={b.id}>{b.batchName}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">বিক্রয়ের ধরন</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" value="weight" checked={saleType === 'weight'} onChange={(e) => setSaleType(e.target.value)} className="text-teal-600 focus:ring-teal-500" />
                <span className="text-sm">ওজন অনুযায়ী</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" value="quantity" checked={saleType === 'quantity'} onChange={(e) => setSaleType(e.target.value)} className="text-teal-600 focus:ring-teal-500" />
                <span className="text-sm">সংখ্যা (পিস) অনুযায়ী</span>
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">তারিখ</label>
              <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ক্রেতার নাম</label>
              <input type="text" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500" placeholder="ক্রেতার নাম (ঐচ্ছিক)" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ক্রেতার মোবাইল নম্বর</label>
              <input type="tel" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500" placeholder="017xxxxxxxx" />
            </div>
            {saleType === 'weight' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">মোট ওজন (কেজি)</label>
                <input required type="number" step="0.01" value={totalWeightKg} onChange={(e) => setTotalWeightKg(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500" placeholder="ওজন" />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">সংখ্যা (টি)</label>
                <input required type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500" placeholder="সংখ্যা" />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {saleType === 'weight' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">সংখ্যা (টি) [ঐচ্ছিক]</label>
                  <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500" placeholder="কতগুলো বিক্রি হলো?" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">প্রতি কেজি দর (৳)</label>
                  <input required type="number" value={pricePerKg} onChange={(e) => setPricePerKg(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500" placeholder="দর" />
                </div>
              </>
            ) : (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">প্রতিটির দাম (৳)</label>
                <input required type="number" value={pricePerPiece} onChange={(e) => setPricePerPiece(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500" placeholder="প্রতিটির দাম" />
              </div>
            )}
          </div>
          
          <div className="bg-teal-50 p-3 rounded-lg flex justify-between items-center mt-2 border border-teal-100">
            <span className="font-semibold text-teal-800">মোট টাকা:</span>
            <span className="font-bold text-teal-700 text-lg">৳ {currentTotalAmount}</span>
          </div>

          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">জমা/নগদ পেয়েছি (৳)</label>
             <input type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500" placeholder={`ডিফল্ট: ৳ ${currentTotalAmount}`} />
             {currentDue > 0 && <p className="text-red-500 text-sm mt-1 font-semibold">বাকি: ৳ {currentDue} (স্বয়ংক্রিয়ভাবে বকেয়া খাতায় যোগ হবে)</p>}
             {currentReturnAmount > 0 && <p className="text-green-600 text-sm mt-1 font-semibold">ক্রেতা ফেরত পাবে: ৳ {currentReturnAmount}</p>}
          </div>

          <button disabled={isSubmitting} type="submit" className="w-full bg-teal-600 text-white font-bold py-3 rounded-xl mt-2 disabled:bg-gray-400">
            {isSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {records.map(record => {
          const batchName = activeBatches.find(b => b.id === record.batchId)?.batchName || 'Unknown Batch';
          const rPaid = record.amountPaid !== undefined ? record.amountPaid : record.totalAmount;
          const rDue = record.totalAmount - rPaid;
          return (
            <div key={record.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-gray-800">{new Date(record.date).toLocaleDateString()}</h3>
                  <p className="text-xs text-gray-500">ব্যাচ: {batchName} {record.buyerName ? `| ক্রেতা: ${record.buyerName}` : ''}</p>
                </div>
                <div className="text-right flex flex-col items-end">
                  <span className="font-bold text-teal-600 text-lg">৳ {record.totalAmount}</span>
                  {rDue > 0 && <span className="text-xs font-semibold text-red-500 outline outline-1 outline-red-200 px-1 rounded mt-1">বাকি: ৳ {rDue}</span>}
                  {rDue === 0 && <span className="text-xs font-semibold text-green-600 outline outline-1 outline-green-200 px-1 rounded mt-1">পরিশোধিত</span>}
                  <button onClick={() => handleDelete(record.id)} className="text-red-500 hover:bg-red-50 p-1 rounded-md mt-1 inline-block">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="bg-gray-50 p-2 rounded text-sm text-gray-600 flex justify-between items-center flex-wrap gap-2">
                {(!record.saleType || record.saleType === 'weight') ? (
                  <>
                    <span>ওজন: {record.totalWeightKg} কেজি</span>
                    {record.quantity > 0 ? <span>সংখ্যা: {record.quantity} টি</span> : null}
                    <span>দর: ৳ {record.pricePerKg}/কেজি</span>
                  </>
                ) : (
                  <>
                    <span>সংখ্যা: {record.quantity} টি</span>
                    <span>প্রতিটির দর: ৳ {record.pricePerPiece}</span>
                  </>
                )}
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
