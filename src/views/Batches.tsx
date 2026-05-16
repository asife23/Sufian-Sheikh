import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Package, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../components/ConfirmModal';

const BatchSummary = ({ batchId, totalChicks, costPerChick }: { batchId: string, totalChicks: number, costPerChick: number }) => {
  const { currentUser } = useAuth();
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

  if (loading) return <div className="text-xs text-gray-400 mt-2">হিসাব লোড হচ্ছে...</div>;

  const profit = totalSales - totalCost;

  return (
    <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
      <div className="flex justify-between mb-1">
        <span className="text-gray-600">মোট বিক্রয়:</span>
        <span className="font-bold text-teal-600">৳ {totalSales.toLocaleString()}</span>
      </div>
      <div className="flex justify-between mb-1">
        <span className="text-gray-600">মোট খরচ:</span>
        <span className="font-bold text-red-600">৳ {totalCost.toLocaleString()}</span>
      </div>
      <div className="border-t border-gray-300 mt-2 pt-2 flex justify-between font-bold text-base">
        <span>নীট {profit >= 0 ? 'লাভ (Profit)' : 'ক্ষতি (Loss)'}:</span>
        <span className={profit >= 0 ? 'text-green-600' : 'text-red-600'}>৳ {Math.abs(profit).toLocaleString()}</span>
      </div>
    </div>
  );
};

export default function Batches() {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { currentUser } = useAuth();
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

      await addDoc(collection(db, 'batches'), newBatch);
      toast.success('নতুন ব্যাচ যোগ করা হয়েছে!');
      setShowForm(false);
      setBatchName('');
      setFarmType('poultry');
      setTotalChicks('');
      setCostPerChick('');
      fetchBatches();
    } catch (error) {
      toast.error('ব্যাচ যোগ করতে সমস্যা হয়েছে।');
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
      await updateDoc(batchRef, { 
        status: 'completed',
        updatedAt: new Date().toISOString()
      });
      toast.success('ব্যাচ সম্পন্ন হয়েছে।');
      setCompleteBatchId(null);
      fetchBatches();
    } catch (error) {
      toast.error('আপডেট করতে সমস্যা হয়েছে।');
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
      await deleteDoc(doc(db, 'batches', deleteId));
      toast.success('ব্যাচ মুছে ফেলা হয়েছে!', { duration: 3000 });
      fetchBatches();
    } catch (error) {
      toast.error('মুছে ফেলতে সমস্যা হয়েছে।');
      handleFirestoreError(error, OperationType.DELETE, 'batches');
    } finally {
      setDeleteId(null);
    }
  };

  if (loading) return <div>লোড হচ্ছে...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Package className="text-green-600" /> ব্যাচ ম্যানেজমেন্ট
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
            <label className="block text-sm font-medium text-gray-700 mb-1">ব্যাচের নাম</label>
            <input required type="text" value={batchName} onChange={(e) => setBatchName(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-green-500 focus:outline-none" placeholder="যেমন: ব্যাচ ১" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">খামারের ধরন</label>
            <select required value={farmType} onChange={(e) => setFarmType(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-green-500 focus:outline-none">
              <option value="poultry">মুরগি / হাঁস / পাখি</option>
              <option value="cattle">গরু / ছাগল / মহিষ</option>
              <option value="fish">মাছ</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">শুরুর তারিখ</label>
            <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-green-500 focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">মোট সংখ্যা</label>
              <input required type="number" value={totalChicks} onChange={(e) => setTotalChicks(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-green-500 focus:outline-none" placeholder="সংখ্যা" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">প্রতিটির ক্রয়মূল্য (৳)</label>
              <input type="number" value={costPerChick} onChange={(e) => setCostPerChick(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-green-500 focus:outline-none" placeholder="দাম" />
            </div>
          </div>
          <button disabled={isSubmitting} type="submit" className="w-full bg-green-600 text-white font-bold py-3 rounded-xl mt-2 disabled:bg-gray-400">
            {isSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
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
                  {batch.farmType === 'cattle' ? 'গরু/ছাগল' : batch.farmType === 'fish' ? 'মাছ' : 'হাঁস/মুরগি'} • শুরু: {new Date(batch.startDate).toLocaleDateString()}
                </p>
              </div>
              <span className={`px-2 py-1 text-xs font-bold rounded-full ${batch.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {batch.status === 'active' ? 'চলমান' : 'সম্পন্ন'}
              </span>
            </div>
            <div className="text-sm bg-gray-50 p-2 rounded my-2">
              <span className="font-semibold text-gray-700">মোট সংখ্যা: </span> {batch.totalChicks} টি <br/>
              <span className="font-semibold text-gray-700">ক্রয়মূল্য: </span> ৳ {batch.costPerChick} (প্রতিটি)
            </div>
            {batch.status === 'active' && (
               <div className="mt-3 text-right">
                 <button onClick={() => setCompleteBatchId(batch.id)} className="text-sm border border-red-500 text-red-600 px-3 py-1 rounded hover:bg-red-50">
                    ব্যাচ শেষ করুন
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
            কোনো ব্যাচ পাওয়া যায়নি। নতুন ব্যাচ যোগ করুন।
          </div>
        )}
      </div>

      <ConfirmModal 
        isOpen={!!completeBatchId}
        title="ব্যাচ শেষ করার নিশ্চিতকরণ"
        message="আপনি কি নিশ্চিত যে এই ব্যাচটি সম্পন্ন করতে চান?"
        onConfirm={markCompleted}
        onCancel={() => setCompleteBatchId(null)}
      />
    
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
