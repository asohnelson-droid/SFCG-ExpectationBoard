import { supabase } from '../lib/supabase';

// Objective scoring and AI-assisted scoring both moved server-side (Edge
// Functions) so the answer key never reaches the browser. See
// supabase/functions/score-test and supabase/functions/ai-score-answer.

/**
 * Asks the ai-score-answer Edge Function to score one open-ended answer.
 * Throws if scoring is unavailable (function not deployed, no AI key, server
 * error) so the caller can tell the facilitator, rather than returning a
 * made-up score that would look like a real result.
 */
export async function scoreOpenEndedAnswer(
  answerId: string
): Promise<{ score: number; feedback: string; confidence: number }> {
  const { data, error } = await supabase.functions.invoke('ai-score-answer', {
    body: { answerId },
  });

  if (error) {
    console.error('AI Scoring Error:', error);
    let serverMessage = '';
    try {
      serverMessage = (await (error as any)?.context?.json?.())?.error || '';
    } catch {
      /* response had no JSON body */
    }
    throw new Error(serverMessage || error.message || 'AI scoring failed');
  }

  return {
    score: data?.score ?? 0,
    feedback: data?.feedback ?? 'No feedback provided',
    confidence: data?.confidence ?? 0,
  };
}
