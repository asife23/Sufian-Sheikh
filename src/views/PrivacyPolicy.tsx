import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-800">প্রাইভেসি পলিসি (Privacy Policy)</h1>
      </div>
      
      <div className="p-4 max-w-3xl mx-auto space-y-6 mt-4">
        <div className="bg-white p-6 rounded-xl shadow border border-gray-100 space-y-4 text-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Privacy Policy for Digital Khamar Pro</h2>
          
          <p>
            This Privacy Policy describes Our policies and procedures on the collection, use and disclosure of Your information when You use the Service and tells You about Your privacy rights and how the law protects You.
          </p>

          <h3 className="text-xl font-semibold text-gray-800 mt-6">Information Collection and Use</h3>
          <p>
            We collect several different types of information for various purposes to provide and improve our Service to you:
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Email address</li>
              <li>First name and last name</li>
              <li>Phone number</li>
              <li>Usage Data</li>
            </ul>
          </p>

          <h3 className="text-xl font-semibold text-gray-800 mt-6">Data Security</h3>
          <p>
            The security of your data is important to us, but remember that no method of transmission over the Internet, or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your Personal Data, we cannot guarantee its absolute security. All data is securely stored in Google Firebase databases with appropriate security rules.
          </p>

          <h3 className="text-xl font-semibold text-gray-800 mt-6">Contact Us</h3>
          <p>
            If you have any questions about this Privacy Policy, You can contact us:
            <ul className="list-disc pl-6 mt-2">
              <li>By email: sr0632890@gmail.com</li>
              <li>By phone number: 01410991934</li>
            </ul>
          </p>
        </div>
      </div>
    </div>
  );
}
