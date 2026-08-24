// supabase/functions/score-test/index.ts
//
// Submits a completed test and scores it server-side.
//
// This replaces the old client-side flow (fetch test_questions including
// correct_answer -> score locally -> write test_submissions +
// test_submission_answers directly). The old flow meant the answer key was
// sitting in the browser as soon as the test loaded — flagged as a known
// limitation in the original DEPLOYMENT.md. Here, the client only ever sends
// the participant's raw answers; correct answers are read and compared with
// the service-role client, which the browser never has access to.
//
// Deploy: supabase functions deploy score-test
// Invoke (client): supabase.functions.invoke('score-test', { body: {...} })

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnswerInput {
  questionId: string;
  text?: string;
  options?: string[];
}

interface RequestBody {
  testId: string;
  participantName: string;
  organization?: string;
  role?: string;
  answers: AnswerInput[];
}

function scoreObjectiveAnswer(
  question: { type: string; correct_answer: unknown; weight: number; acceptable_answers: string[] | null },
  answer: { text?: string; options?: string[] },
): number {
  const { type, correct_answer, weight } = question;

  if (type === "multiple_choice" || type === "true_false") {
    return answer.options?.[0] === correct_answer ? weight : 0;
  }

  if (type === "multiple_select") {
    const correctSet = new Set((correct_answer as string[]) || []);
    const selectedSet = new Set(answer.options || []);
    if (correctSet.size !== selectedSet.size) return 0;
    for (const opt of correctSet) {
      if (!selectedSet.has(opt)) return 0;
    }
    return weight;
  }

  if (type === "short_answer") {
    const normalizedAnswer = (answer.text || "").trim().toLowerCase();
    const normalizedCorrect = ((correct_answer as string) || "").trim().toLowerCase();
    const normalizedAlternatives = (question.acceptable_answers || []).map((a) => a.trim().toLowerCase());
    if (normalizedAnswer === normalizedCorrect || normalizedAlternatives.includes(normalizedAnswer)) {
      return weight;
    }
    return 0;
  }

  // paragraph, or anything else: not objectively scorable here.
  return 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Caller-scoped client: used only to verify who's asking.
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    const body: RequestBody = await req.json();
    if (!body.testId || !body.participantName || !Array.isArray(body.answers)) {
      return new Response(JSON.stringify({ error: "testId, participantName, and answers are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role client: the only place that reads correct_answer/rubric.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: test, error: testErr } = await admin
      .from("tests")
      .select("id, status, scoring_mode")
      .eq("id", body.testId)
      .single();

    if (testErr || !test) {
      return new Response(JSON.stringify({ error: "Test not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (test.status !== "live") {
      return new Response(JSON.stringify({ error: "This test is not currently active" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: questions, error: qErr } = await admin
      .from("test_questions")
      .select("id, type, weight, correct_answer, acceptable_answers")
      .eq("test_id", body.testId);

    if (qErr || !questions) {
      return new Response(JSON.stringify({ error: "Could not load questions" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: submission, error: subErr } = await admin
      .from("test_submissions")
      .insert({
        test_id: body.testId,
        participant_name: body.participantName,
        organization: body.organization ?? null,
        role: body.role ?? null,
        access_token: callerId,
        submitted_at: new Date().toISOString(),
        status: "submitted",
        total_score: 0,
        ai_score_status: "pending",
        requires_manual_review: test.scoring_mode !== "auto",
      })
      .select("id")
      .single();

    if (subErr || !submission) {
      return new Response(JSON.stringify({ error: subErr?.message || "Could not create submission" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalScore = 0;
    const answerRows = body.answers.map((a) => {
      const question = questions.find((q) => q.id === a.questionId);
      let awardedScore = 0;
      if (question && ["multiple_choice", "multiple_select", "true_false", "short_answer"].includes(question.type)) {
        awardedScore = scoreObjectiveAnswer(question, a);
        totalScore += isNaN(awardedScore) ? 0 : awardedScore;
      }
      return {
        submission_id: submission.id,
        question_id: a.questionId,
        answer_text: a.text || "",
        selected_options: a.options || [],
        awarded_score: isNaN(awardedScore) ? 0 : awardedScore,
        final_review_status: "pending",
      };
    });

    if (answerRows.length > 0) {
      const { error: answersErr } = await admin.from("test_submission_answers").insert(answerRows);
      if (answersErr) {
        return new Response(JSON.stringify({ error: answersErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    await admin
      .from("test_submissions")
      .update({ total_score: isNaN(totalScore) ? 0 : totalScore })
      .eq("id", submission.id);

    return new Response(JSON.stringify({ submissionId: submission.id, totalScore }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
