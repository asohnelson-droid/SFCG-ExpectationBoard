import React from 'react';
import { TestAnalyticsDashboard } from '../../components/test/TestAnalyticsDashboard';
import { BackButton } from '../../components/BackButton';
import { BarChart3 } from 'lucide-react';

export const AnalyticsDashboardPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-zinc-50 p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton fallbackPath="/dashboard" />
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20">
                <BarChart3 size={24} />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-brand-navy">Test Analytics Dashboard</h1>
                <p className="text-zinc-500 text-sm">Insights across all your events and assessments</p>
              </div>
            </div>
          </div>
        </header>

        <TestAnalyticsDashboard />
      </div>
    </div>
  );
};
