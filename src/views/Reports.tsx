import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { BarChart3, TrendingDown, TrendingUp, AlertCircle, Download, FileText, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Papa from 'papaparse';
import toast from 'react-hot-toast';

export default function Reports() {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const [activeBatches, setActiveBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Aggregated Data
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [totalFeedCost, setTotalFeedCost] = useState(0);
  const [totalMedicineCost, setTotalMedicineCost] = useState(0);
  const [totalMortality, setTotalMortality] = useState(0);

  useEffect(() => {
    fetchBatches();
  }, [currentUser]);

  useEffect(() => {
    if (selectedBatchId) fetchReportData(selectedBatchId);
  }, [selectedBatchId]);

  const fetchBatches = async () => {
    if (!currentUser) return;
    try {
      const q = query(collection(db, 'batches'), where('userId', '==', currentUser.uid));
      const snap = await getDocs(q);
      const batches = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActiveBatches(batches);
      if(batches.length > 0) setSelectedBatchId(batches[0].id);
      setLoading(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'batches');
    }
  };

  const fetchReportData = async (batchId: string) => {
    setLoading(true);
    if (!currentUser) return;
    try {
      // Fetch Expenses
      const expQ = query(collection(db, 'expenses'), where('userId', '==', currentUser.uid), where('batchId', '==', batchId));
      const expSnap = await getDocs(expQ);
      let tExpenses = 0;
      expSnap.forEach(doc => tExpenses += (Number(doc.data().amount) || 0));
      setTotalExpenses(tExpenses);

      // Fetch Sales
      const salesQ = query(collection(db, 'sales'), where('userId', '==', currentUser.uid), where('batchId', '==', batchId));
      const salesSnap = await getDocs(salesQ);
      let tSales = 0;
      salesSnap.forEach(doc => tSales += (Number(doc.data().totalAmount) || 0));
      setTotalSales(tSales);

      // Fetch Feed Cost
      const feedQ = query(collection(db, 'feed_records'), where('userId', '==', currentUser.uid), where('batchId', '==', batchId));
      const feedSnap = await getDocs(feedQ);
      let tFeed = 0;
      feedSnap.forEach(doc => tFeed += (Number(doc.data().cost) || 0));
      setTotalFeedCost(tFeed);

      // Fetch Medicine Cost
      const medQ = query(collection(db, 'medicine_records'), where('userId', '==', currentUser.uid), where('batchId', '==', batchId));
      const medSnap = await getDocs(medQ);
      let tMed = 0;
      medSnap.forEach(doc => tMed += (Number(doc.data().cost) || 0));
      setTotalMedicineCost(tMed);

      // Fetch Mortality
      const mortQ = query(collection(db, 'mortality'), where('userId', '==', currentUser.uid), where('batchId', '==', batchId));
      const mortSnap = await getDocs(mortQ);
      let tMort = 0;
      mortSnap.forEach(doc => tMort += (Number(doc.data().count) || 0));
      setTotalMortality(tMort);
      
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'reports');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !selectedBatchId) return <div>{t('common.loading')}</div>;

  const selectedBatch = activeBatches.find(b => b.id === selectedBatchId);
  const originalChicksTotalCost = selectedBatch ? (selectedBatch.totalChicks * selectedBatch.costPerChick) : 0;
  const totalCost = totalExpenses + totalFeedCost + totalMedicineCost;
  const grandTotalCost = totalCost + originalChicksTotalCost;
  const finalNetProfit = totalSales - grandTotalCost;

  const generatePDF = () => {
    if (!selectedBatch) return;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Farm Report', 14, 22);
    
    doc.setFontSize(12);
    doc.text(`Batch Name: ${selectedBatch.batchName}`, 14, 32);
    doc.text(`Status: ${selectedBatch.status === 'active' ? 'Active' : 'Completed'}`, 14, 38);
    
    const tableData = [
      ['Initial Purchase Cost', `${originalChicksTotalCost}`],
      ['Feed Cost', `${totalFeedCost}`],
      ['Medicine Cost', `${totalMedicineCost}`],
      ['Other Expenses', `${totalExpenses}`],
      ['Total Cost', `${grandTotalCost}`],
      ['Total Sales', `${totalSales}`],
      ['Net Profit/Loss', `${finalNetProfit}`],
      ['Total Mortality', `${totalMortality}`],
    ];

    (doc as any).autoTable({
      startY: 45,
      head: [['Metric', 'Amount (BDT) / Count']],
      body: tableData,
      theme: 'grid',
    });

    doc.save(`${selectedBatch.batchName}_Report.pdf`);
    toast.success(t('reports.pdfStarted'));
  };

  const generateCSV = () => {
    if (!selectedBatch) return;
    
    const data = [
      { Metric: 'Initial Purchase Cost', Value: originalChicksTotalCost },
      { Metric: 'Feed Cost', Value: totalFeedCost },
      { Metric: 'Medicine Cost', Value: totalMedicineCost },
      { Metric: 'Other Expenses', Value: totalExpenses },
      { Metric: 'Total Cost', Value: grandTotalCost },
      { Metric: 'Total Sales', Value: totalSales },
      { Metric: 'Net Profit', Value: finalNetProfit },
      { Metric: 'Mortality', Value: totalMortality },
    ];

    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${selectedBatch.batchName}_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(t('reports.csvStarted'));
  };

  return (
    <div className="space-y-4 pb-4">
      <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="text-indigo-600" />
          <h2 className="text-xl font-bold text-gray-800">{t('reports.title')}</h2>
        </div>
        {selectedBatchId && (
          <div className="flex gap-2">
            <button onClick={generateCSV} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100" title="Download Excel/CSV">
              <FileSpreadsheet size={20} />
            </button>
            <button onClick={generatePDF} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100" title="Download PDF">
              <FileText size={20} />
            </button>
          </div>
        )}
      </div>

      <div className="bg-white p-4 rounded-xl shadow border border-indigo-100">
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('reports.selectBatch')}</label>
        <select value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 font-medium text-gray-800 bg-gray-50">
          {activeBatches.map(b => (
            <option key={b.id} value={b.id}>{b.batchName} ({b.status === 'active' ? t('feed.statusActive') : t('feed.statusCompleted')})</option>
          ))}
        </select>
      </div>

      {selectedBatchId && (
        <div className="space-y-4">
          <div className={`p-5 rounded-2xl text-white shadow-md ${finalNetProfit >= 0 ? 'bg-gradient-to-br from-green-500 to-green-600' : 'bg-gradient-to-br from-red-500 to-red-600'}`}>
            <h3 className="text-white/80 text-sm mb-1 font-medium flex items-center justify-between">
              {finalNetProfit >= 0 ? t('reports.netProfit') : t('reports.netLoss')} 
              {finalNetProfit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            </h3>
            <p className="text-4xl font-bold">৳ {Math.abs(finalNetProfit).toLocaleString()}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">{t('reports.totalIncome')}</p>
                <p className="text-lg font-bold text-teal-600">৳ {totalSales.toLocaleString()}</p>
             </div>
             <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">{t('reports.grandTotalCost')}</p>
                <p className="text-lg font-bold text-red-600">৳ {grandTotalCost.toLocaleString()}</p>
             </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
             <div className="bg-gray-50 p-3 border-b border-gray-100 font-bold text-gray-700">
                {t('reports.breakdown')}
             </div>
             <div className="p-4 space-y-3">
                <div className="flex justify-between items-center text-sm">
                   <span className="text-gray-600">{t('reports.costBuy')}</span>
                   <span className="font-semibold text-gray-800">৳ {originalChicksTotalCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                   <span className="text-gray-600">{t('reports.costFeed')}</span>
                   <span className="font-semibold text-gray-800">৳ {totalFeedCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                   <span className="text-gray-600">{t('reports.costMedicine')}</span>
                   <span className="font-semibold text-gray-800">৳ {totalMedicineCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                   <span className="text-gray-600">{t('reports.costOther')}</span>
                   <span className="font-semibold text-gray-800">৳ {totalExpenses.toLocaleString()}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                   <span className="font-bold text-gray-800">{t('reports.grandTotalCost')}</span>
                   <span className="font-bold text-red-600">৳ {grandTotalCost.toLocaleString()}</span>
                </div>
             </div>
          </div>

          <div className="bg-orange-50 rounded-xl p-4 shadow-sm border border-orange-100 flex items-start gap-3">
            <div className="bg-orange-100 p-2 rounded-full text-orange-600 align-top">
               <AlertCircle size={20} />
            </div>
            <div>
               <h4 className="font-bold text-orange-800">{t('reports.healthSummary')}</h4>
               <p className="text-sm text-orange-700 mt-1">
                 {t('reports.totalMortality')}: <strong>{totalMortality}</strong> 
                 {selectedBatch && selectedBatch.totalChicks > 0 && ` (${((totalMortality / selectedBatch.totalChicks) * 100).toFixed(2)}%)`}
               </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
