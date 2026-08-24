import { supabase } from '../lib/supabase';

// Objective scoring and AI-assisted scoring both moved server-side (Edge
// Functions) so the answer key never reaches the browser. See
// supabase/functions/score-test and supabase/functions/ai-score-answer.

export async function scoreOpenEndedAnswer(
  answerId: string
): Promise<{ score: number; feedback: string; confidence: number }> {
  const { data, error } = await supabase.functions.invoke('ai-score-answer', {
    body: { answerId },
  });

  if (error) {
    console.error('AI Scoring Error:', error);
    return { score: 0, feedback: 'Error during AI assessment', confidence: 0 };
  }

  return {
    score: data?.score ?? 0,
    feedback: data?.feedback ?? 'No feedback provided',
    confidence: data?.confidence ?? 0,
  };
}
