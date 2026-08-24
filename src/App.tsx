import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LandingPage } from './pages/LandingPage';
import { FacilitatorDashboard } from './pages/FacilitatorDashboard';
import { CreateEventPage } from './pages/CreateEventPage';
import { EventDetail } from './pages/EventDetail';
import { ParticipantSubmission } from './pages/ParticipantSubmission';
import { LiveDisplay } from './pages/LiveDisplay';
import { TakeTest } from './pages/participant/TakeTest';
import { TestReview } from './pages/admin/TestReview';
import { TestAnalytics } from './pages/admin/TestAnalytics';
import { AnalyticsDashboardPage } from './pages/admin/AnalyticsDashboardPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/event/:slug/submit" element={<ParticipantSubmission />} />
            <Route path="/event/:slug/live" element={<LiveDisplay />} />
            <Route path="/test/:testId" element={<TakeTest />} />

            {/* Protected Facilitator Routes */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <FacilitatorDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/create-event" 
              element={
                <ProtectedRoute>
                  <CreateEventPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/event/:slug" 
              element={
                <ProtectedRoute>
                  <EventDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/tests/:testId/review" 
              element={
                <ProtectedRoute>
                  <TestReview />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/tests/:testId/analytics" 
              element={
                <ProtectedRoute>
                  <TestAnalytics />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/analytics" 
              element={
                <ProtectedRoute>
                  <AnalyticsDashboardPage />
                </ProtectedRoute>
              } 
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
