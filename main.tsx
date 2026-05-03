/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { Toaster } from 'react-hot-toast';
import SplashScreen from './components/SplashScreen';
import AuthView from './components/AuthView';
import MainView from './components/MainView';

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <SplashScreen />;
  }

  return user ? <MainView /> : <AuthView />;
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 font-sans">
          <AppContent />
          <Toaster position="top-center" reverseOrder={false} />
        </div>
      </SocketProvider>
    </AuthProvider>
  );
}
