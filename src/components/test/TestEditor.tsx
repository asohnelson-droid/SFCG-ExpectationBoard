import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { mapTest, mapTestQuestion } from '../../lib/mappers';
import { Test, TestQuestion, QuestionType, TestType, ScoringMode } from '../../types/test';
import { Plus, Trash2, Save, X, Settings, List, Clock } from 'lucide-react';
import { motion } from 'motion/react';

interface TestEditorProps {
  eventId: string;
  testId?: string;
  onClose: () => void;
}

export const TestEditor: React.FC<TestEditorProps> = ({ eventId, testId, onClose }) => {
  const { t } = useTranslation();
  const [test, setTest] = useState<Partial<Test>>({
    eventId,
    type: 'pre_test',
    title: '',
    instructions: '',
    status: 'draft',
    scoringMode: 'auto',
    passMark: 0,
  });
  const [questions, setQuestions] = useState<Partial<TestQuestion>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'questions'>('settings');

  useEffect(() => {
    const loadData = async () => {
      if (testId) {
        const { data: testRow } = await supabase.from('tests').select('*').eq('id', testId).maybeSingle();
        if (testRow) {
          setTest(mapTest(testRow));

          const { data: questionRows } = await supabase
            .from('test_questions')
            .select('*')
            .eq('test_id', testId);
          const questionData = (questionRows || []).map(mapTestQuestion);
          setQuestions(questionData.sort((a, b) => a.orderIndex - b.orderIndex));
        }
      } else {
        setQuestions([
          {
            type: 'multiple_choice',
            text: '',
            isRequired: true,
            weight: 1,
            orderIndex: 0,
            options: ['Option 1', 'Option 2'],
            correctAnswer: 'Option 1'
          }
        ]);
      }
      setLoading(false);
    };

    loadData();
  }, [testId, eventId]);

  const handleAddQuestion = () => {
    const newQuestion: Partial<TestQuestion> = {
      type: 'multiple_choice',
      text: '',
      isRequired: true,
      weight: 1,
      orderIndex: questions.length,
      options: ['Option 1', 'Option 2'],
      correctAnswer: 'Option 1'
    };
    setQuestions([...questions, newQuestion]);
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleUpdateQuestion = (index: number, updates: Partial<TestQuestion>) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], ...updates };
    setQuestions(newQuestions);
  };

  const handleSave = async () => {
    if (!test.title) {
      alert(t('testEditor.actions.errorTitle'));
      return;
    }

    const hasEmptyQuestion = questions.some(q => !q.text || q.text.trim() === '');
    if (hasEmptyQuestion) {
      alert(t('testEditor.actions.errorEmptyQuestions'));
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert(t('common.errorNotAuthenticated'));
      return;
    }

    setSaving(true);
    try {
      let currentTestId = testId;

      const testPayload = {
        event_id: test.eventId,
        type: test.type,
        title: test.title,
        instructions: test.instructions,
        status: test.status,
        scoring_mode: test.scoringMode,
        pass_mark: test.passMark,
        updated_at: new Date().toISOString(),
      };

      if (testId) {
        const { error } = await supabase.from('tests').update(testPayload).eq('id', testId);
        if (error) throw error;
      } else {
        const { data: newTest, error } = await supabase
          .from('tests')
          .insert({ ...testPayload, created_by: user.id })
          .select('id')
          .single();
        if (error) throw error;
        currentTestId = newTest.id;
      }

      if (!currentTestId) throw new Error("Test ID not generated");

      // Replace all questions for this test with a clean set.
      const { error: deleteErr } = await supabase.from('test_questions').delete().eq('test_id', currentTestId);
      if (deleteErr) throw deleteErr;

      const questionRows = questions.map((q, index) => ({
        test_id: currentTestId,
        type: q.type,
        text: q.text,
        help_text: q.helpText,
        is_required: q.isRequired,
        weight: q.weight,
        order_index: index,
        options: q.options,
        correct_answer: q.correctAnswer ?? null,
        acceptable_answers: q.acceptableAnswers,
        rubric: q.rubric,
      }));

      if (questionRows.length > 0) {
        const { error: insertErr } = await supabase.from('test_questions').insert(questionRows);
        if (insertErr) throw insertErr;
      }

      onClose();
    } catch (error) {
      console.error("Critical error in handleSave:", error);
      alert(t('testEditor.actions.errorSave'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center">{t('testEditor.loading')}</div>;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {testId ? t('testEditor.editTitle') : t('testEditor.createTitle')}
            </h2>
            <p className="text-sm text-gray-500">
              {t('testEditor.subtitle', { title: test.title || t('testEditor.subtitleDefault') })}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 border-b border-gray-100">
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'settings' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Settings size={16} />
            <span>{t('testEditor.tabs.settings')}</span>
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'questions' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <List size={16} />
            <span>{t('testEditor.tabs.questions', { count: questions.length })}</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
          {activeTab === 'settings' ? (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('testEditor.settings.titleLabel')}</label>
                  <input
                    type="text"
                    value={test.title}
                    onChange={(e) => setTest({ ...test, title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    placeholder={t('testEditor.settings.titlePlaceholder')}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('testEditor.settings.typeLabel')}</label>
                    <select
                      value={test.type}
                      onChange={(e) => setTest({ ...test, type: e.target.value as TestType })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="pre_test">{t('testEditor.settings.typePre')}</option>
                      <option value="post_test">{t('testEditor.settings.typePost')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('testEditor.settings.scoringLabel')}</label>
                    <select
                      value={test.scoringMode}
                      onChange={(e) => setTest({ ...test, scoringMode: e.target.value as ScoringMode })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="auto">{t('testEditor.settings.scoringAuto')}</option>
                      <option value="ai">{t('testEditor.settings.scoringAi')}</option>
                      <option value="hybrid">{t('testEditor.settings.scoringHybrid')}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('testEditor.settings.instructionsLabel')}</label>
                  <textarea
                    value={test.instructions}
                    onChange={(e) => setTest({ ...test, instructions: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                    placeholder={t('testEditor.settings.instructionsPlaceholder')}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('testEditor.settings.passMarkLabel')}</label>
                  <input
                    type="number"
                    value={test.passMark || 0}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setTest({ ...test, passMark: isNaN(val) ? 0 : val });
                    }}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    min="0"
                    max="100"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative group"
                >
                  <div className="absolute -left-3 top-6 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </div>

                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 mr-4">
                      <input
                        type="text"
                        value={q.text}
                        onChange={(e) => handleUpdateQuestion(index, { text: e.target.value })}
                        className="w-full text-lg font-bold text-gray-900 border-b border-transparent hover:border-gray-200 focus:border-indigo-500 outline-none py-1"
                        placeholder={t('testEditor.questions.placeholder')}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={q.type}
                        onChange={(e) => handleUpdateQuestion(index, { type: e.target.value as QuestionType })}
                        className="text-xs font-bold bg-gray-100 px-2 py-1 rounded border-none outline-none"
                      >
                        <option value="multiple_choice">{t('testEditor.questions.types.multiple_choice')}</option>
                        <option value="multiple_select">{t('testEditor.questions.types.multiple_select')}</option>
                        <option value="short_answer">{t('testEditor.questions.types.short_answer')}</option>
                        <option value="paragraph">{t('testEditor.questions.types.paragraph')}</option>
                        <option value="true_false">{t('testEditor.questions.types.true_false')}</option>
                      </select>
                      <button
                        onClick={() => handleRemoveQuestion(index)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Question Specific Fields */}
                  <div className="space-y-4 pl-2">
                    {(q.type === 'multiple_choice' || q.type === 'multiple_select') && (
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase">{t('testEditor.questions.optionsLabel')}</label>
                        {q.options?.map((opt, optIndex) => (
                          <div key={optIndex} className="flex items-center gap-2">
                            <input
                              type={q.type === 'multiple_choice' ? 'radio' : 'checkbox'}
                              checked={q.type === 'multiple_choice' ? q.correctAnswer === opt : (q.correctAnswer as string[])?.includes(opt)}
                              onChange={() => {
                                if (q.type === 'multiple_choice') {
                                  handleUpdateQuestion(index, { correctAnswer: opt });
                                } else {
                                  const current = Array.isArray(q.correctAnswer) ? (q.correctAnswer as string[]) : [];
                                  const next = current.includes(opt) ? current.filter(o => o !== opt) : [...current, opt];
                                  handleUpdateQuestion(index, { correctAnswer: next });
                                }
                              }}
                              className="w-4 h-4 text-indigo-600"
                            />
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const newOpts = [...(q.options || [])];
                                newOpts[optIndex] = e.target.value;
                                handleUpdateQuestion(index, { options: newOpts });
                              }}
                              className="flex-1 text-sm border-b border-gray-100 focus:border-indigo-500 outline-none"
                            />
                            <button
                              onClick={() => {
                                const newOpts = q.options?.filter((_, i) => i !== optIndex);
                                handleUpdateQuestion(index, { options: newOpts });
                              }}
                              className="text-gray-300 hover:text-red-400"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => handleUpdateQuestion(index, { options: [...(q.options || []), `Option ${(q.options?.length || 0) + 1}`] })}
                          className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          <Plus size={12} />
                          <span>{t('testEditor.questions.addOption')}</span>
                        </button>
                      </div>
                    )}

                    {q.type === 'true_false' && (
                      <div className="flex gap-4">
                        <button
                          onClick={() => handleUpdateQuestion(index, { correctAnswer: 'True' })}
                          className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${
                            q.correctAnswer === 'True' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'
                          }`}
                        >
                          {t('testEditor.questions.true')}
                        </button>
                        <button
                          onClick={() => handleUpdateQuestion(index, { correctAnswer: 'False' })}
                          className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${
                            q.correctAnswer === 'False' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'
                          }`}
                        >
                          {t('testEditor.questions.false')}
                        </button>
                      </div>
                    )}

                    {(q.type === 'short_answer' || q.type === 'paragraph') && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{t('testEditor.questions.modelAnswerLabel')}</label>
                          <textarea
                            value={q.correctAnswer as string || ''}
                            onChange={(e) => handleUpdateQuestion(index, { correctAnswer: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg h-20 resize-none outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder={t('testEditor.questions.modelAnswerPlaceholder')}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{t('testEditor.questions.rubricLabel')}</label>
                          <textarea
                            value={q.rubric || ''}
                            onChange={(e) => handleUpdateQuestion(index, { rubric: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg h-20 resize-none outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder={t('testEditor.questions.rubricPlaceholder')}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-6 pt-2">
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">{t('testEditor.questions.weightLabel')}</label>
                        <input
                          type="number"
                          value={q.weight || 0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            handleUpdateQuestion(index, { weight: isNaN(val) ? 0 : val });
                          }}
                          className="w-16 px-2 py-1 border border-gray-200 rounded text-sm outline-none"
                          min="0"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={q.isRequired}
                          onChange={(e) => handleUpdateQuestion(index, { isRequired: e.target.checked })}
                          className="w-4 h-4 text-indigo-600"
                          id={`req-${index}`}
                        />
                        <label htmlFor={`req-${index}`} className="text-[10px] font-bold text-gray-400 uppercase cursor-pointer">{t('testEditor.questions.requiredLabel')}</label>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}

              <button
                onClick={handleAddQuestion}
                className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 font-bold"
              >
                <Plus size={20} />
                <span>{t('testEditor.questions.addQuestion')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-white">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {t('testEditor.actions.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Clock className="animate-spin" size={18} />
                <span>{t('testEditor.actions.saving')}</span>
              </>
            ) : (
              <>
                <Save size={18} />
                <span>{t('testEditor.actions.save')}</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
