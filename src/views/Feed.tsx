import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, offlineSafeDocWrite, fastGetDocs } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ClipboardList, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../components/ConfirmModal';

export default function Feed() {
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
  const [quantityBags, setQuantityBags] = useState('');
  const [pricePerBag, setPricePerBag] = useState('');
  const [feedType, setFeedType] = useState('Starter / প্রাথমিক');
  const [details, setDetails] = useState('');
  const [personName, setPersonName] = useState('');
  const [personPhone, setPersonPhone] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [farmType, setFarmType] = useState('poultry');

  // Handle batch selection
  const handleBatchChange = (id: string) => {
    setBatchId(id);
    const batch = activeBatches.find(b => b.id === id);
    if (batch) {
      const fType = batch.farmType || 'poultry';
      setFarmType(fType);
      if (fType === 'cattle') {
        setFeedType(t('feed.cattleOption'));
      } else if (fType === 'fish') {
        setFeedType(t('feed.fishFloat'));
      } else {
        setFeedType(t('feed.starter'));
      }
    } else {
      setFarmType('poultry');
      setFeedType(t('feed.starter'));
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [currentUser]);

  const fetchInitialData = async () => {
    if (!currentUser) return;
    try {
      // Fetch active batches
      const batchesQuery = query(collection(db, 'batches'), where('userId', '==', currentUser.uid), where('status', '==', 'active'));
      const batchSnap = await fastGetDocs(batchesQuery);
      const batches: any[] = batchSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActiveBatches(batches);
      if(batches.length > 0) {
        setBatchId(batches[0].id);
        const b = batches[0];
        setFarmType(b.farmType || 'poultry');
        if (b.farmType === 'cattle') setFeedType('দানা/ভুষি (Cattle/Goat)');
        else if (b.farmType === 'fish') setFeedType('ভাসমান খাবার (Fish)');
        else setFeedType('Starter / প্রাথমিক'); // Leave default here for intial load, the language effect can remap it later if needed, but it's simpler to remap in form
      }

      // Fetch feed records
      const feedQuery = query(collection(db, 'feed_records'), where('userId', '==', currentUser.uid));
      const feedSnap = await fastGetDocs(feedQuery);
      const fetchedRecords = feedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecords(fetchedRecords.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'feed_records');
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
      await offlineSafeDocWrite(deleteDoc(doc(db, 'feed_records', deleteId)));
      toast.success(t('common.success'), { duration: 3000 });
      fetchInitialData();
    } catch (error) {
      toast.error(t('common.error'));
      handleFirestoreError(error, OperationType.DELETE, 'feed_records');
    } finally {
      setDeleteId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !batchId) return toast.error(t('feed.batchSelectionReq'));
    if (isSubmitting || submitLock.current) return;

    const quantity = Number(quantityBags);
    const price = Number(pricePerBag);
    const totalAmountVal = quantity * price;
    const paidValRaw = amountPaid ? Number(amountPaid) : totalAmountVal;
    const paidVal = Math.min(paidValRaw, totalAmountVal);

    if (paidVal < totalAmountVal && !personName.trim()) {
      return toast.error(t('feed.dueNameReq'));
    }

    setIsSubmitting(true);
    submitLock.current = true;

    try {
      const newRecord = {
        userId: currentUser.uid,
        batchId,
        date,
        feedType,
        quantityBags: quantity,
        cost: totalAmountVal,
        pricePerBag: price,
        amountPaid: paidVal,
        personName,
        details,
        createdAt: new Date().toISOString()
      };

      await offlineSafeDocWrite(addDoc(collection(db, 'feed_records'), newRecord));

      if (paidVal < totalAmountVal) {
        const batchName = activeBatches.find(b => b.id === batchId)?.batchName || 'Unknown Batch';
        const dueRecord = {
          userId: currentUser.uid,
          personName,
          phone: personPhone,
          type: 'payable',
          amount: totalAmountVal,
          totalPaid: paidVal,
          details: `${batchName}${t('feed.feedFood').replace('{type}', feedType)}${details || ''}`,
          recordDate: date,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await offlineSafeDocWrite(addDoc(collection(db, 'dues'), dueRecord));
      }

      toast.success(t('feed.addSuccess'));
      setShowForm(false);
      setQuantityBags('');
      setPricePerBag('');
      setAmountPaid('');
      setDetails('');
      setPersonName('');
      setPersonPhone('');
      fetchInitialData();
    } catch (error) {
      toast.error(t('feed.addError'));
      handleFirestoreError(error, OperationType.CREATE, 'feed_records');
    } finally {
      setIsSubmitting(false);
      submitLock.current = false;
    }
  };

  if (loading) return <div>{t('common.loading')}</div>;

  const currentTotalAmount = Number(quantityBags) * Number(pricePerBag) || 0;
  const currentPaidRaw = amountPaid !== '' ? Number(amountPaid) : currentTotalAmount;
  const currentDue = Math.max(0, currentTotalAmount - currentPaidRaw);
  const currentReturnAmount = amountPaid !== '' ? Math.max(0, currentPaidRaw - currentTotalAmount) : 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <ClipboardList className="text-orange-500" /> {t('feed.title')}
        </h2>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-orange-500 text-white p-2 rounded-lg hover:bg-orange-600"
        >
          <Plus size={20} />
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-xl shadow border border-orange-100 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('feed.selectBatch')}</label>
            <select required value={batchId} onChange={(e) => handleBatchChange(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-orange-500 bg-white">
              <option value="">{t('feed.selectOption')}</option>
              {activeBatches.map(b => <option key={b.id} value={b.id}>{b.batchName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('feed.date')}</label>
            <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-orange-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('feed.feedType')}</label>
            <select required value={feedType} onChange={(e) => setFeedType(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-orange-500 bg-white">
              {farmType === 'poultry' && (
                <>
                  <option value={t('feed.starter')}>{t('feed.starter')}</option>
                  <option value={t('feed.grower')}>{t('feed.grower')}</option>
                  <option value={t('feed.finisher')}>{t('feed.finisher')}</option>
                </>
              )}
              {farmType === 'cattle' && (
                <>
                  <option value={t('feed.cattleOption')}>{t('feed.cattleOption')}</option>
                  <option value={t('feed.grass')}>{t('feed.grass')}</option>
                  <option value={t('feed.hay')}>{t('feed.hay')}</option>
                  <option value={t('feed.silage')}>{t('feed.silage')}</option>
                </>
              )}
              {farmType === 'fish' && (
                <>
                  <option value={t('feed.fishFloat')}>{t('feed.fishFloat')}</option>
                  <option value={t('feed.fishSink')}>{t('feed.fishSink')}</option>
                  <option value={t('feed.khoil')}>{t('feed.khoil')}</option>
                </>
              )}
              <option value={t('feed.other')}>{t('feed.other')}</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('feed.quantityBags')}</label>
              <input required type="number" step="0.01" value={quantityBags} onChange={(e) => setQuantityBags(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-orange-500" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('feed.pricePerUnit')}</label>
              <input required type="number" value={pricePerBag} onChange={(e) => setPricePerBag(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-orange-500" placeholder="0" />
            </div>
          </div>
          <div className="bg-orange-50 p-3 rounded-lg flex justify-between items-center mt-2 border border-orange-100">
            <span className="text-gray-700 font-medium">{t('feed.totalPrice')}</span>
            <span className="font-bold text-orange-600 text-lg">৳ {currentTotalAmount}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('feed.shopName')}</label>
              <input type="text" value={personName} onChange={(e) => setPersonName(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-orange-500" placeholder={t('feed.shopPlaceholder')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('feed.mobileNum')}</label>
              <input type="tel" value={personPhone} onChange={(e) => setPersonPhone(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-orange-500" placeholder="01xxxxxxxxx" />
            </div>
          </div>
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">{t('feed.paidAmt')}</label>
             <input type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-orange-500" placeholder={`${t('feed.defaultAmt')}৳ ${currentTotalAmount}`} />
          </div>
          {currentDue > 0 && <p className="text-red-500 text-sm font-semibold">{t('feed.dueMsg')}{currentDue}{t('feed.dueMsgAuto')}</p>}
          {currentReturnAmount > 0 && <p className="text-green-600 text-sm font-semibold">{t('feed.returnMsg')}{currentReturnAmount}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.details')}</label>
            <input type="text" value={details} onChange={(e) => setDetails(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-orange-500" />
          </div>
          <button disabled={isSubmitting} type="submit" className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl mt-2 disabled:bg-gray-400">
            {isSubmitting ? t('common.saving') : t('common.save')}
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
                <p className="text-xs text-gray-500">{new Date(record.date).toLocaleDateString()} - {batchName}</p>
                <h3 className="font-bold text-gray-800">{record.feedType}</h3>
                <p className="text-sm text-gray-600">{record.quantityBags}{t('feed.amountLabel')}{record.pricePerBag ? `(৳ ${record.pricePerBag}${t('feed.perUnitLabel')})` : ''}</p>
                {record.personName && <p className="text-xs font-semibold text-gray-600 mt-0.5">{t('feed.shopLabel')}{record.personName}</p>}
                {record.details && <p className="text-sm text-gray-600 mt-1">{record.details}</p>}
              </div>
              <div className="text-right flex flex-col items-end">
                <span className="font-bold text-orange-600 text-lg">৳ {record.cost}</span>
                {rDue > 0 && <span className="text-xs font-semibold text-red-500 outline outline-1 outline-red-200 px-1 rounded mt-1">{t('feed.dueLabel')}{rDue}</span>}
                {rDue === 0 && <span className="text-xs font-semibold text-green-600 outline outline-1 outline-green-200 px-1 rounded mt-1">{t('feed.paidLabel')}</span>}
                <button onClick={() => handleDelete(record.id)} className="text-red-500 hover:bg-red-50 p-1 rounded-md mt-1 inline-block">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}

        {records.length === 0 && !showForm && (
          <div className="text-center text-gray-500 py-10 bg-white rounded-xl border border-dashed border-gray-300">
            {t('feed.noRecords')}
          </div>
        )}
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
