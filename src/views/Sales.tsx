import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, offlineSafeDocWrite, fastGetDocs } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ShoppingCart, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../components/ConfirmModal';

export default function Sales() {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { currentUser } = useAuth();
  const { t } = useLanguage();
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
    if (!currentUser) return;
    setLoading(true);

    const batchesQuery = query(collection(db, 'batches'), where('userId', '==', currentUser.uid));
    const unsubscribeBatches = onSnapshot(batchesQuery, (snap) => {
      const batches: any[] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      setActiveBatches(batches);
      if(batches.length > 0 && !batchId) {
        setBatchId(batches[0].id);
        if (batches[0].farmType === 'cattle') {
          setSaleType('quantity');
        } else {
          setSaleType('weight');
        }
      }
    });

    const salesQuery = query(collection(db, 'sales'), where('userId', '==', currentUser.uid));
    const unsubscribeSales = onSnapshot(salesQuery, (snap) => {
      const fetchedRecords = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      setRecords(fetchedRecords.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sales');
      setLoading(false);
    });

    return () => {
      unsubscribeBatches();
      unsubscribeSales();
    };
  }, [currentUser]);

  const fetchInitialData = async () => {
    // No-op: Data is now synced automatically by onSnapshot
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
      await offlineSafeDocWrite(deleteDoc(doc(db, 'sales', deleteId)));
      toast.success(t('common.success'), { duration: 3000 });
      fetchInitialData();
    } catch (error) {
      toast.error(t('common.error'));
      handleFirestoreError(error, OperationType.DELETE, 'sales');
    } finally {
      setDeleteId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !batchId) return toast.error(t('feed.batchSelectionReq'));
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
      return toast.error(t('sales.missingReceiver'));
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

      await offlineSafeDocWrite(addDoc(collection(db, 'sales'), newRecord));

      if (paidVal < totalAmountVal) {
        const batchName = activeBatches.find(b => b.id === batchId)?.batchName || 'Unknown Batch';
        const dueRecord = {
          userId: currentUser.uid,
          personName: buyerName,
          phone: buyerPhone,
          type: 'receivable',
          amount: totalAmountVal,
          totalPaid: paidVal,
          details: `${batchName}${t('sales.saleDetails')}`,
          recordDate: date,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await offlineSafeDocWrite(addDoc(collection(db, 'dues'), dueRecord));
      }

      toast.success(t('sales.addSuccess'));
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
      toast.error(t('common.error'));
      handleFirestoreError(error, OperationType.CREATE, 'sales');
    } finally {
      setIsSubmitting(false);
      submitLock.current = false;
    }
  };

  if (loading) return <div>{t('common.loading')}</div>;

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
          <ShoppingCart className="text-teal-600" /> {t('sales.title')}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('medicine.batchLabel')}</label>
            <select required value={batchId} onChange={(e) => handleBatchChange(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 bg-white">
              <option value="">{t('feed.selectOption')}</option>
              {activeBatches.map(b => <option key={b.id} value={b.id}>{b.batchName}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('sales.saleTypeLabel')}</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" value="weight" checked={saleType === 'weight'} onChange={(e) => setSaleType(e.target.value)} className="text-teal-600 focus:ring-teal-500" />
                <span className="text-sm">{t('sales.typeWeight')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" value="quantity" checked={saleType === 'quantity'} onChange={(e) => setSaleType(e.target.value)} className="text-teal-600 focus:ring-teal-500" />
                <span className="text-sm">{t('sales.typeQuantity')}</span>
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('medicine.dateLabel')}</label>
              <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('sales.buyerName')}</label>
              <input type="text" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500" placeholder={t('sales.buyerNamePlaceholder')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('sales.buyerPhone')}</label>
              <input type="tel" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500" placeholder={t('sales.buyerPhonePlaceholder')} />
            </div>
            {saleType === 'weight' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('sales.totalWeight')}</label>
                <input required type="number" step="0.01" value={totalWeightKg} onChange={(e) => setTotalWeightKg(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500" placeholder={t('sales.weightPlaceholder')} />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('sales.quantityCount')}</label>
                <input required type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500" placeholder={t('sales.qtyPlaceholder')} />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {saleType === 'weight' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('sales.qtyOptional')}</label>
                  <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500" placeholder={t('sales.qtySoldPlaceholder')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('sales.pricePerKgLabel')}</label>
                  <input required type="number" value={pricePerKg} onChange={(e) => setPricePerKg(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500" placeholder={t('sales.pricePerKgPlaceholder')} />
                </div>
              </>
            ) : (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('sales.pricePerPieceLabel')}</label>
                <input required type="number" value={pricePerPiece} onChange={(e) => setPricePerPiece(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500" placeholder={t('sales.pricePerPiecePlaceholder')} />
              </div>
            )}
          </div>
          
          <div className="bg-teal-50 p-3 rounded-lg flex justify-between items-center mt-2 border border-teal-100">
            <span className="font-semibold text-teal-800">{t('sales.totalMoney')}</span>
            <span className="font-bold text-teal-700 text-lg">৳ {currentTotalAmount}</span>
          </div>

          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">{t('sales.cashReceived')}</label>
             <input type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500" placeholder={`${t('sales.cashPlaceholder')}${currentTotalAmount}`} />
             {currentDue > 0 && <p className="text-red-500 text-sm mt-1 font-semibold">{t('feed.dueMsg')}{currentDue}{t('feed.dueMsgAuto')}</p>}
             {currentReturnAmount > 0 && <p className="text-green-600 text-sm mt-1 font-semibold">{t('sales.returnToBuyer')}{currentReturnAmount}</p>}
          </div>

          <button disabled={isSubmitting} type="submit" className="w-full bg-teal-600 text-white font-bold py-3 rounded-xl mt-2 disabled:bg-gray-400">
            {isSubmitting ? t('common.saving') : t('common.save')}
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
                  <p className="text-xs text-gray-500">{t('sales.batchTxt')}{batchName} {record.buyerName ? `${t('sales.buyerTxt')}${record.buyerName}` : ''}</p>
                </div>
                <div className="text-right flex flex-col items-end">
                  <span className="font-bold text-teal-600 text-lg">৳ {record.totalAmount}</span>
                  {rDue > 0 && <span className="text-xs font-semibold text-red-500 outline outline-1 outline-red-200 px-1 rounded mt-1">{t('feed.dueLabel')}{rDue}</span>}
                  {rDue === 0 && <span className="text-xs font-semibold text-green-600 outline outline-1 outline-green-200 px-1 rounded mt-1">{t('feed.paidLabel')}</span>}
                  <button onClick={() => handleDelete(record.id)} className="text-red-500 hover:bg-red-50 p-1 rounded-md mt-1 inline-block">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="bg-gray-50 p-2 rounded text-sm text-gray-600 flex justify-between items-center flex-wrap gap-2">
                {(!record.saleType || record.saleType === 'weight') ? (
                  <>
                    <span>{t('sales.weightTxt')}{record.totalWeightKg}{t('sales.kgTxt')}</span>
                    {record.quantity > 0 ? <span>{t('sales.qtyTxt')}{record.quantity}{t('sales.pcsTxt')}</span> : null}
                    <span>{t('sales.rateTxt')}{record.pricePerKg}{t('sales.perKgTxt')}</span>
                  </>
                ) : (
                  <>
                    <span>{t('sales.qtyTxt')}{record.quantity}{t('sales.pcsTxt')}</span>
                    <span>{t('sales.pieceRateTxt')}{record.pricePerPiece}</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    
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
