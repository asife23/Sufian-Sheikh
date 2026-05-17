import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { ShieldCheck, Info, CheckCircle, ChevronDown } from 'lucide-react';

export default function Guidelines() {
  const { t, language } = useLanguage();
  const [farmType, setFarmType] = useState('poultry');

  const getSponsorText = () => {
    switch (farmType) {
      case 'poultry':
        return language === 'en' 
          ? 'Sponsored by: Nourish Poultry & Hatchery' 
          : 'সৌজন্যে: নারিশ পোল্ট্রি এন্ড হ্যাচারি';
      case 'dairy':
        return language === 'en'
          ? 'Sponsored by: ACI Godrej Agrovet'
          : 'সৌজন্যে: এসিআই গোদরেজ এগ্রোভেট';
      case 'goat':
        return language === 'en'
          ? 'Sponsored by: Renata Animal Health'
          : 'সৌজন্যে: রেনেটা এনিমেল হেলথ';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-4 pb-10">
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl p-4 text-white shadow-lg flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
             {t('guidelines.title')}
          </h2>
          <p className="text-sm opacity-90">{t('guidelines.subtitle')}</p>
        </div>
        <ShieldCheck size={36} className="text-white opacity-80" />
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <label className="block text-sm font-bold text-gray-700 mb-2">{t('guidelines.farmType')}</label>
        <div className="relative">
          <select 
            value={farmType}
            onChange={(e) => setFarmType(e.target.value)}
            className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-3 px-4 pr-8 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          >
            <option value="poultry">{t('guidelines.poultry')}</option>
            <option value="dairy">{t('guidelines.dairy')}</option>
            <option value="goat">{t('guidelines.goat')}</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
            <ChevronDown size={18} />
          </div>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-1 rounded-bl-lg">
          SPONSOR
        </div>
        <h3 className="font-bold text-indigo-900 mb-1">{t('guidelines.sponsorTitle')}</h3>
        <p className="text-sm text-indigo-700 mb-2 font-medium">{getSponsorText()}</p>
        <p className="text-sm text-gray-600 mb-4">{t('guidelines.sponsorDesc')}</p>

        <div className="bg-white rounded-lg p-3 shadow-sm border border-indigo-50">
          <h4 className="font-bold text-sm text-gray-800 mb-2 flex items-center gap-1">
            <Info size={16} className="text-indigo-500" />
            {t('guidelines.profitHeadline')}
          </h4>
          <ul className="text-sm text-gray-600 space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
              <span>{t('guidelines.profitPoint1')}</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
              <span>{t('guidelines.profitPoint2')}</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
              <span>{t('guidelines.profitPoint3')}</span>
            </li>
          </ul>
        </div>
      </div>

      <h3 className="font-bold text-gray-800 pt-2">{t('guidelines.routineTitle')}</h3>
      
      {farmType === 'poultry' && (
        <div className="space-y-3">
          {[
            { tag: language === 'bn' ? '১-৩ দিন' : '1-3 Days', feed: language === 'bn' ? 'ব্রয়লার স্টার্টার (১০০ গ্রাম/পাখি)' : 'Broiler Starter (100g/bird)', med: language === 'bn' ? 'গ্লুকোজ + ভিটামিন সি' : 'Glucose + Vitamin C' },
            { tag: language === 'bn' ? '৪-১০ দিন' : '4-10 Days', feed: language === 'bn' ? 'স্টার্টার ফিড' : 'Starter Feed', med: language === 'bn' ? 'রানিক্ষেত ভ্যাকসিন (৫ম দিন)' : 'Ranikhet Vaccine (Day 5)' },
            { tag: language === 'bn' ? '১১-২০ দিন' : '11-20 Days', feed: language === 'bn' ? 'গ্রোয়ার ফিড' : 'Grower Feed', med: language === 'bn' ? 'গামবোরো ভ্যাকসিন (১৪শ দিন)' : 'Gumboro Vaccine (Day 14)' },
            { tag: language === 'bn' ? '২১-৩৫ দিন' : '21-35 Days', feed: language === 'bn' ? 'ফিনিশার ফিড (যতটুকু খাবে)' : 'Finisher Feed (Ad libitum)', med: language === 'bn' ? 'ক্যালসিয়াম সাপ্লিমেন্ট' : 'Calcium Supplement' }
          ].map((item, idx) => (
             <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4">
                <div className="bg-teal-50 text-teal-700 font-bold px-3 py-1 rounded border border-teal-100 whitespace-nowrap self-start">
                  {item.tag}
                </div>
                <div className="flex-1 text-sm space-y-1">
                  <p><span className="font-semibold text-gray-700">{t('guidelines.feedInfo')}</span> {item.feed}</p>
                  <p><span className="font-semibold text-gray-700">{t('guidelines.medicineInfo')}</span> {item.med}</p>
                </div>
             </div>
          ))}
        </div>
      )}

      {farmType === 'dairy' && (
        <div className="space-y-3">
          {[
            { tag: language === 'bn' ? 'বাছুর (১-৩ মাস)' : 'Calf (1-3 Mo)', feed: language === 'bn' ? 'দুধ + কাঁচা ঘাস' : 'Milk + Green Grass', med: language === 'bn' ? 'কৃমিনাশক (১ মাস বয়সে)' : 'De-wormer (at 1 Month)' },
            { tag: language === 'bn' ? 'বাড়ন্ত (৩-১২ মাস)' : 'Growing (3-12 Mo)', feed: language === 'bn' ? 'দানা জাতীয় খাদ্য ১.৫ কেজি + ঘাস' : 'Concentrate 1.5kg + Grass', med: language === 'bn' ? 'ভিটামিন এডিই ইনজেকশন' : 'Vitamin ADE injection' },
            { tag: language === 'bn' ? 'দুধালো গাভী' : 'Milking Cow', feed: language === 'bn' ? 'দানা ৩-৪ কেজি + পর্যাপ্ত কাঁচা ঘাস' : 'Concentrate 3-4kg + Grass', med: language === 'bn' ? 'ক্যালসিয়াম বোলাস + জিংক' : 'Calcium Bolus + Zinc' },
          ].map((item, idx) => (
             <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4 mt-2">
                <div className="bg-blue-50 text-blue-700 font-bold px-3 py-1 rounded border border-blue-100 whitespace-nowrap self-start">
                  {item.tag}
                </div>
                <div className="flex-1 text-sm space-y-1">
                  <p><span className="font-semibold text-gray-700">{t('guidelines.feedInfo')}</span> {item.feed}</p>
                  <p><span className="font-semibold text-gray-700">{t('guidelines.medicineInfo')}</span> {item.med}</p>
                </div>
             </div>
          ))}
        </div>
      )}

      {farmType === 'goat' && (
        <div className="space-y-3">
          {[
            { tag: language === 'bn' ? '০-১ মাস' : '0-1 Month', feed: language === 'bn' ? 'মায়ের দুধ' : 'Mother milk', med: language === 'bn' ? 'পি.পি.আর ভ্যাকসিন' : 'PPR Vaccine' },
            { tag: language === 'bn' ? '২-৬ মাস' : '2-6 Months', feed: language === 'bn' ? 'দানা ২০০ গ্রাম + ঘাস/লতা' : 'Concentrate 200g + Grass', med: language === 'bn' ? 'কৃমিনাশক বড়ি' : 'De-wormer tab' },
            { tag: language === 'bn' ? 'ফ্যাটেনিং' : 'Fattening', feed: language === 'bn' ? 'দানা ৫০০ গ্রাম + কাঁঠাল পাতা' : 'Concentrate 500g + Jackfruit leaf', med: language === 'bn' ? 'লিভার টনিক' : 'Liver Tonic' },
          ].map((item, idx) => (
             <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4 mt-2">
                <div className="bg-orange-50 text-orange-700 font-bold px-3 py-1 rounded border border-orange-100 whitespace-nowrap self-start">
                  {item.tag}
                </div>
                <div className="flex-1 text-sm space-y-1">
                  <p><span className="font-semibold text-gray-700">{t('guidelines.feedInfo')}</span> {item.feed}</p>
                  <p><span className="font-semibold text-gray-700">{t('guidelines.medicineInfo')}</span> {item.med}</p>
                </div>
             </div>
          ))}
        </div>
      )}
      
    </div>
  );
}
