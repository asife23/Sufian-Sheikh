import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, Package, ClipboardList, Wallet, FileText, Menu, AlertTriangle, ShieldPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Toaster } from 'react-hot-toast';

export default function Layout() {
  const { currentUser } = useAuth();
  const location = useLocation();

  if (!currentUser) return <Outlet />;

  const navItems = [
    { name: 'ড্যাশবোর্ড', path: '/', icon: Home },
    { name: 'ব্যাচ', path: '/batches', icon: Package },
    { name: 'খাবার', path: '/feed', icon: ClipboardList },
    { name: 'ঔষধ', path: '/medicine', icon: ShieldPlus },
    { name: 'হিসাব', path: '/expenses', icon: Wallet },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-16">
      <Toaster position="top-center" />
      
      {/* Top Bar */}
      <header className="bg-green-600 text-white shadow-md sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between relative max-w-2xl mx-auto w-full">
          <div className="w-8"></div> {/* Spacer for symmetry */}
          <h1 className="text-xl font-bold flex-1 text-center">ডিজিটাল খামার</h1>
          <Link to="/profile" className="p-1 hover:bg-green-700 rounded-full transition-colors w-8 h-8 flex items-center justify-center">
            {currentUser?.photoURL ? (
              <img src={currentUser.photoURL} alt="Profile" className="w-8 h-8 rounded-full border-2 border-white object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center bg-green-500">
                 <span className="text-sm font-bold">{currentUser?.displayName?.charAt(0) || 'U'}</span>
              </div>
            )}
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 shadow-inner z-10">
        <div className="flex justify-around p-2 max-w-2xl mx-auto w-full">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
                isActive ? 'text-green-600 font-semibold' : 'text-gray-500 hover:text-green-500'
              }`}
            >
              <Icon size={24} />
              <span className="text-[10px] mt-1">{item.name}</span>
            </Link>
          );
        })}
        </div>
      </nav>
    </div>
  );
};
