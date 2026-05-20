import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  currentUser: null, 
  loading: true,
  logout: async () => {} 
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error('SignOut error, clearing user manually:', e);
    } finally {
      setCurrentUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, loading, logout }}>
      {loading ? (
        <div className="min-h-screen flex flex-col items-center justify-center bg-green-700">
          <div className="text-center animate-pulse">
            <img src="/icon-512x512.png" alt="Digital Farm Logo" className="w-32 h-32 mx-auto drop-shadow-xl mb-4" />
            <h1 className="text-4xl font-bold text-white tracking-wider">Digital Farm</h1>
            <p className="mt-2 text-green-100 font-medium font-sans">Smart Livestock & Farm Manager</p>
          </div>
          <div className="absolute bottom-10 w-2/3 max-w-xs">
            <div className="h-1 w-full bg-green-800 rounded-full overflow-hidden">
              <div className="h-full bg-white animate-pulse rounded-full w-2/3 mx-auto"></div>
            </div>
            <p className="text-center text-green-200 text-sm mt-3">অপেক্ষা করুন...</p>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};
