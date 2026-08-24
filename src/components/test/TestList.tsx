import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { mapTest } from '../../lib/mappers';
import { Test } from '../../types/test';
import { Plus, Edit2, Trash2, Play, Pause, BarChart2, FileText, CheckCircle, Clock, QrCode, X, Copy, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';

interface TestListProps {
  eventId: string;
  onEdit: (testId: string) => void;
  onDelete: (testId: string) => void;
  onToggleStatus: (testId: string, currentStatus: string) => void;
}

export const TestList: React.FC<TestListProps> = ({ eventId, onEdit, onDelete, onToggleStatus }) => {
  const { t } = useTranslation();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQrModal, setShowQrModal] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    const loadTests = async () => {
      const { data, error } = await supabase
        .from('tests')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error loading tests:', error);
      } else {
        setTests((data || []).map(mapTest));
      }
      setLoading(false);
    };

    loadTests();

    const channel = supabase
      .channel(`event-tests-${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tests', filter: `event_id=eq.${eventId}` },
        () => loadTests()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  const handleCopyLink = (testId: string) => {
    const link = `${window.location.origin}/test/${testId}`;
    navigator.clipboard.writeText(link);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Clock className="animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">{t('testList.title')}</h2>
        <button
          onClick={() => onEdit('')}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={18} />
          <span>{t('testList.createButton')}</span>
        </button>
      </div>

      {tests.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <FileText className="mx-auto text-gray-400 mb-3" size={48} />
          <p className="text-gray-500">{t('testList.noTests')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tests.map((test) => (
            <motion.div
              key={test.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                      test.type === 'pre_test' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {t(`test.types.${test.type}`)}
                    </span>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                      test.status === 'live' ? 'bg-green-100 text-green-700' :
                      test.status === 'closed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {t(`test.statuses.${test.status}`)}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">{test.title}</h3>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setShowQrModal(test.id)}
                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title={t('testList.tooltips.showQr')}
                  >
                    <QrCode size={18} />
                  </button>
                  <button
                    onClick={() => onEdit(test.id)}
                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title={t('testList.tooltips.edit')}
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => onDelete(test.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title={t('testList.tooltips.delete')}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                <div className="flex gap-2">
                  <Link
                    to={`/admin/tests/${test.id}/review`}
                    className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-indigo-600 px-3 py-1.5 rounded-md hover:bg-indigo-50 transition-colors"
                  >
                    <CheckCircle size={16} />
                    <span>{t('testList.actions.review')}</span>
                  </Link>
                  <Link
                    to={`/admin/tests/${test.id}/analytics`}
                    className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-indigo-600 px-3 py-1.5 rounded-md hover:bg-indigo-50 transition-colors"
                  >
                    <BarChart2 size={16} />
                    <span>{t('testList.actions.analytics')}</span>
                  </Link>
                </div>

                <button
                  onClick={() => onToggleStatus(test.id, test.status)}
                  className={`flex items-center gap-1.5 text-sm font-bold px-4 py-1.5 rounded-lg transition-all ${
                    test.status === 'live'
                      ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {test.status === 'live' ? (
                    <>
                      <Pause size={16} fill="currentColor" />
                      <span>{t('testList.actions.close')}</span>
                    </>
                  ) : (
                    <>
                      <Play size={16} fill="currentColor" />
                      <span>{t('testList.actions.goLive')}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQrModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 relative"
            >
              <button
                onClick={() => setShowQrModal(null)}
                className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
              >
                <X size={20} />
              </button>

              <div className="text-center space-y-6">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-gray-900">{t('testList.qrModal.title')}</h3>
                  <p className="text-sm text-gray-500">{t('testList.qrModal.subtitle')}</p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-inner flex justify-center">
                  <QRCodeSVG
                    value={`${window.location.origin}/test/${showQrModal}`}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleCopyLink(showQrModal)}
                    className="flex items-center justify-center gap-2 w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-colors"
                  >
                    {copySuccess ? (
                      <>
                        <CheckCircle2 size={18} className="text-green-600" />
                        <span className="text-green-600">{t('testList.qrModal.copied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy size={18} />
                        <span>{t('testList.qrModal.copyLink')}</span>
                      </>
                    )}
                  </button>
                  <a
                    href={`${window.location.origin}/test/${showQrModal}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-colors"
                  >
                    <Play size={18} />
                    <span>{t('testList.qrModal.openPage')}</span>
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
