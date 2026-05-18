import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, offlineSafeDocWrite, fastGetDocs } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { FileText, Plus, CheckCircle, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../components/ConfirmModal';

export default function Dues() {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLock = useRef(false);
  const [paymentRecordId, setPaymentRecordId] = useState<string | null>(null);
  const [markPaidId, setMarkPaidId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [showForm, setShowForm] = useState(false);
  const [personName, setPersonName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState('payable');
  const [amount, setAmount] = useState('');
  const [details, setDetails] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchInitialData();
  }, [currentUser]);

  const summary = useMemo(() => {
    const map: Record<string, { payable: number; receivable: number; totalRecords: number }> = {};
    records.forEach(r => {
      if (!map[r.personName]) map[r.personName] = { payable: 0, receivable: 0, totalRecords: 0 };
      map[r.personName].totalRecords += 1;

      const remaining = r.amount - (r.totalPaid || 0);
      if (remaining > 0) {
        if (r.type === 'payable') map[r.personName].payable += remaining;
        else if (r.type === 'receivable') map[r.personName].receivable += remaining;
      }
    });
    return map;
  }, [records]);

  const summaryKeys = Object.keys(summary).sort();

  const fetchInitialData = async () => {
    if (!currentUser) return;
    try {
      const q = query(collection(db, 'dues'), where('userId', '==', currentUser.uid));
      const snap = await fastGetDocs(q);
      const fetchedRecords = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecords(fetchedRecords.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'dues');
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
      const newRecord = {
        userId: currentUser.uid,
        personName,
        phone,
        type,
        amount: Number(amount),
        totalPaid: 0,
        details,
        recordDate: date,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await offlineSafeDocWrite(addDoc(collection(db, 'dues'), newRecord));
      toast.success(t('medicine.addSuccess'));
      setShowForm(false);
      setPersonName('');
      setPhone('');
      setAmount('');
      setDetails('');
      setDate(new Date().toISOString().split('T')[0]);
      fetchInitialData();
    } catch (error) {
      toast.error(t('common.error'));
      handleFirestoreError(error, OperationType.CREATE, 'dues');
    } finally {
      setIsSubmitting(false);
      submitLock.current = false;
    }
  };

    const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const executeDelete = async () => {
    if (!deleteId) return;
    try {
      await offlineSafeDocWrite(deleteDoc(doc(db, 'dues', deleteId)));
      toast.success(t('common.success'), { duration: 3000 });
      fetchInitialData();
    } catch (error) {
      toast.error(t('common.error'));
      handleFirestoreError(error, OperationType.DELETE, 'dues');
    } finally {
      setDeleteId(null);
    }
  };

  const handlePartialPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentRecordId || !paymentAmount || isSubmitting || submitLock.current) return;
    
    const record = records.find(r => r.id === paymentRecordId);
    if (!record) return;

    setIsSubmitting(true);
    submitLock.current = true;
    try {
      const currentPaid = Number(record.totalPaid) || 0;
      const addedPaid = Number(paymentAmount);
      const remainingDue = Number(record.amount) - currentPaid;
      
      const paymentAmountToUse = Math.min(addedPaid, remainingDue);
      const returnAmount = Math.max(0, addedPaid - remainingDue);
      
      const newTotalPaid = currentPaid + paymentAmountToUse;
      
      const isFullyPaid = newTotalPaid >= Number(record.amount);
      const paymentHistory = record.payments || [];
      const newPayment = {
        date: paymentDate || new Date().toISOString().split('T')[0],
        amount: paymentAmountToUse
      };

      const ref = doc(db, 'dues', paymentRecordId);
      await offlineSafeDocWrite(updateDoc(ref, { 
        amount: Number(record.amount),
        totalPaid: newTotalPaid,
        payments: [...paymentHistory, newPayment],
        status: isFullyPaid ? 'paid' : 'pending',
        updatedAt: new Date().toISOString()
      }));
      
      if (returnAmount > 0) {
        toast.success(`${t('dues.updateReturn')}${returnAmount}`, { duration: 5000 });
      } else {
        toast.success(t('dues.updateSuccess'));
      }
      setPaymentRecordId(null);
      setPaymentAmount('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      fetchInitialData();
    } catch (error) {
      toast.error(t('common.error'));
      handleFirestoreError(error, OperationType.UPDATE, `dues/${paymentRecordId}`);
    } finally {
      setIsSubmitting(false);
      submitLock.current = false;
    }
  };

  const markPaid = async () => {
    if(!markPaidId) return;
    if (isSubmitting || submitLock.current) return;
    setIsSubmitting(true);
    submitLock.current = true;
    try {
      const recordId = markPaidId;
      const record = records.find(r => r.id === recordId);
      if (!record) return;
      const remainingDue = Number(record.amount) - (Number(record.totalPaid) || 0);

      const ref = doc(db, 'dues', recordId);
      const updateData: any = {
        amount: Number(record.amount),
        status: 'paid',
        totalPaid: Number(record.amount),
        updatedAt: new Date().toISOString()
      };

      if (remainingDue > 0) {
        updateData.payments = [...(record.payments || []), {
          date: new Date().toISOString().split('T')[0],
          amount: remainingDue
        }];
      }

      await offlineSafeDocWrite(updateDoc(ref, updateData));
      toast.success(t('dues.markPaidSuccess'));
      setMarkPaidId(null);
      fetchInitialData();
    } catch (error) {
      toast.error(t('common.error'));
      handleFirestoreError(error, OperationType.UPDATE, `dues/${markPaidId}`);
    } finally {
      setIsSubmitting(false);
      submitLock.current = false;
      setMarkPaidId(null);
    }
  };

  if (loading) return <div>{t('common.loading')}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <FileText className="text-pink-600" /> {t('dues.title')}
        </h2>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-pink-600 text-white p-2 rounded-lg hover:bg-pink-700"
        >
          <Plus size={20} />
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-xl shadow border border-pink-100 space-y-3">
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">{t('dues.whatRecord')}</label>
             <div className="flex gap-4 mb-2">
                <label className="flex items-center gap-2">
                  <input type="radio" value="payable" checked={type === 'payable'} onChange={(e) => setType(e.target.value)} className="accent-pink-600" />
                  {t('dues.payable')}
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" value="receivable" checked={type === 'receivable'} onChange={(e) => setType(e.target.value)} className="accent-pink-600" />
                  {t('dues.receivable')}
                </label>
             </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('dues.personLabel')}</label>
              <input required type="text" value={personName} onChange={(e) => setPersonName(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-pink-500" placeholder={t('dues.personPlaceholder')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('medicine.mobileLabel')}</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-pink-500" placeholder={t('medicine.mobilePlaceholder')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('dues.amountLabel')}</label>
              <input required type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-pink-500" placeholder={t('dues.amountPlaceholder')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('medicine.dateLabel')}</label>
              <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-pink-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('dues.detailsLabel')}</label>
            <input type="text" value={details} onChange={(e) => setDetails(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-pink-500" placeholder={t('dues.detailsPlaceholder')} />
          </div>
          <button disabled={isSubmitting} type="submit" className="w-full bg-pink-600 text-white font-bold py-3 rounded-xl mt-2 disabled:bg-gray-400">
            {isSubmitting ? t('common.saving') : t('common.save')}
          </button>
        </form>
      )}

      {summaryKeys.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden mt-4">
          <div className="w-full bg-purple-50 text-purple-800 p-3 font-bold flex items-center justify-between">
            <span className="flex items-center gap-2">👥 {t('dues.summaryTitle')}</span>
          </div>
          <div className="p-3 bg-white space-y-2 border-t border-purple-100">
            {summaryKeys.map(name => {
              const s = summary[name];
              if (s.receivable === 0 && s.payable === 0) return null;
              return (
                <div key={name} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                  <span className="font-bold text-gray-800">{name} <span className="text-gray-400 font-normal text-xs">({s.totalRecords} {t('dues.recordCount')})</span></span>
                  <div className="text-right flex flex-col gap-0.5">
                    {s.receivable > 0 && <span className="text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded text-xs inline-block">{t('dues.totalReceivable')} {s.receivable}</span>}
                    {s.payable > 0 && <span className="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded text-xs inline-block">{t('dues.totalPayable')} {s.payable}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-6 mb-2 px-1">
        <h3 className="font-bold text-gray-700">{t('dues.allTransactions')}</h3>
      </div>

      <div className="space-y-3">
        {records.length === 0 && !loading && (
          <p className="text-center text-gray-500 py-8">{t('dues.dueEmpty')}</p>
        )}
        {records.map(record => {
          const isPayable = record.type === 'payable';
          const totalPaid = record.totalPaid || 0;
          const remainingDue = record.amount - totalPaid;
          const s = summary[record.personName];
          return (
            <div key={record.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm relative">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold mb-1 inline-block ${isPayable ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {isPayable ? t('dues.payable') : t('dues.receivable')}
                  </span>
                  <h3 className="font-bold text-gray-800 flex items-center gap-2 flex-wrap">
                    {record.personName}
                  </h3>
                  {s && s.totalRecords > 1 && (s.receivable > 0 || s.payable > 0) && (
                    <div className="text-[10px] bg-purple-50 text-purple-700 px-2 py-1 rounded inline-block mt-1 font-semibold border border-purple-100">
                      {t('dues.summaryTitle').substring(0, 15)} {t('dues.personLabel').split('/')[2]}: 
                      {s.receivable > 0 ? ` ${t('dues.totalReceivable')}${s.receivable}` : ''}
                      {s.receivable > 0 && s.payable > 0 ? ' | ' : ''}
                      {s.payable > 0 ? ` ${t('dues.totalPayable')}${s.payable}` : ''}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 font-medium mt-1 mb-0.5">
                    📅 {isPayable ? t('medicine.dateLabel') : t('medicine.dateLabel')}: {new Date(record.recordDate || record.createdAt).toLocaleDateString()}
                  </p>
                  {record.phone && <p className="text-xs text-blue-600 font-medium my-0.5">📞 <a href={`tel:${record.phone}`}>{record.phone}</a></p>}
                  <p className="text-xs text-gray-500 text-ellipsis overflow-hidden mt-1">{record.details}</p>
                </div>
                <div className="text-right flex flex-col items-end">
                  <span className="font-bold text-gray-800 text-lg">{t('sales.totalMoney').replace(':', '')}: ৳ {record.amount}</span>
                  <span className="text-sm font-semibold text-green-600 outline outline-1 outline-green-200 px-1 rounded">{t('dues.totalSettle')} ৳ {totalPaid}</span>
                  <span className="font-bold text-red-600 text-md mt-1">{t('dues.remainingDue')} ৳ {remainingDue > 0 ? remainingDue : 0}</span>
                  <button onClick={() => handleDelete(record.id)} className="text-red-500 hover:bg-red-50 p-1 rounded-md mt-2 inline-block">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              {record.payments && record.payments.length > 0 && (
                <div className="mt-2 text-xs text-gray-500 border-t border-gray-100 pt-2 w-full text-right">
                  <p className="font-semibold mb-1">{t('dues.historyTitle')}:</p>
                  {record.payments.map((p: any, idx: number) => (
                    <p key={idx}>{new Date(p.date).toLocaleDateString()}: <span className="font-semibold text-green-600">৳ {p.amount}</span></p>
                  ))}
                </div>
              )}

              <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                <span className={`text-xs font-semibold ${record.status === 'paid' ? 'text-green-600' : 'text-orange-500'}`}>
                   {record.status === 'paid' ? `✔️ ${t('dues.statusPaid')}` : t('dues.statusPending')}
                </span>
                {record.status === 'pending' && (
                  <div className="flex gap-2">
                    <button disabled={isSubmitting} onClick={() => setPaymentRecordId(record.id)} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 border border-blue-200 disabled:opacity-50">
                      <Plus size={14} /> {t('dues.addDepositBtn')}
                    </button>
                    <button disabled={isSubmitting} onClick={() => setMarkPaidId(record.id)} className="flex items-center gap-1 text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded-lg hover:bg-green-100 border border-green-200 disabled:opacity-50">
                      <CheckCircle size={14} /> {t('dues.markPaidBtn')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    
      {/* Partial Payment Modal */}
      {paymentRecordId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="bg-blue-600 p-4">
              <h3 className="text-white font-bold text-lg">{t('dues.addDepositBtn')}</h3>
            </div>
            <form onSubmit={handlePartialPayment} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('dues.amountLabel')}</label>
                <input 
                  type="number" 
                  value={paymentAmount} 
                  onChange={(e) => setPaymentAmount(e.target.value)} 
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500" 
                  placeholder={t('dues.payAmount')} 
                  required 
                  min="1"
                />
                {paymentRecordId && paymentAmount && Number(paymentAmount) > ((records.find(r => r.id === paymentRecordId)?.amount || 0) - (records.find(r => r.id === paymentRecordId)?.totalPaid || 0)) && (
                  <p className="text-green-600 text-sm mt-1 font-semibold">
                    {t('sales.returnToBuyer').replace('Buyer', t('dues.personLabel').split('/')[2] || 'person')} ৳ {Number(paymentAmount) - ((records.find(r => r.id === paymentRecordId)?.amount || 0) - (records.find(r => r.id === paymentRecordId)?.totalPaid || 0))}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('dues.payDate')}</label>
                <input 
                  type="date" 
                  value={paymentDate} 
                  onChange={(e) => setPaymentDate(e.target.value)} 
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500" 
                  required 
                />
              </div>
              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setPaymentRecordId(null)} 
                  className="flex-1 bg-gray-100 text-gray-700 font-bold py-2 rounded-lg hover:bg-gray-200"
                >
                  {t('dues.cancelBtn')}
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                >
                  {isSubmitting ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={!!markPaidId}
        title={t('dues.markPaidBtn')}
        message={t('dues.verifyPayMsg')}
        onConfirm={markPaid}
        onCancel={() => setMarkPaidId(null)}
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
