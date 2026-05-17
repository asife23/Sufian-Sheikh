/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Login from './views/Login';
import Dashboard from './views/Dashboard';
import Batches from './views/Batches';
import Feed from './views/Feed';
import Medicine from './views/Medicine';
import Mortality from './views/Mortality';
import Expenses from './views/Expenses';
import Sales from './views/Sales';
import Dues from './views/Dues';
import Reports from './views/Reports';
import Profile from './views/Profile';
import Guidelines from './views/Guidelines';
import PrivacyPolicy from './views/PrivacyPolicy';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser } = useAuth();
  return currentUser ? <>{children}</> : <Navigate to="/login" />;
};

function AppRoutes() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="batches" element={<Batches />} />
          <Route path="feed" element={<Feed />} />
          <Route path="medicine" element={<Medicine />} />
          <Route path="mortality" element={<Mortality />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="sales" element={<Sales />} />
          <Route path="dues" element={<Dues />} />
          <Route path="reports" element={<Reports />} />
          <Route path="profile" element={<Profile />} />
          <Route path="guidelines" element={<Guidelines />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <Toaster position="top-center" />
        <AppRoutes />
      </LanguageProvider>
    </AuthProvider>
  );
}
