// supabase/functions/ai-score-answer/index.ts
//
// AI-assisted scoring for open-ended (short_answer/paragraph) test answers.
// Facilitator/admin-only — used from the Test Review screen's "Score with AI"
// button. Ported from the old src/services/aiScoringService.ts, which called
// Gemini directly from the browser using a key injected into the client
// bundle via Vite's `define`. Here the key stays a server-side secret and is
// never shipped to the browser.
//
// This mirrors the ORIGINAL app's disabled-by-default behavior: if
// GEMINI_API_KEY isn't set as a function secret, it returns a clear
// "unavailable" result instead of erroring, exactly like the old code did.
//
// Setup (optional — only needed if you want AI-assisted scoring enabled):
//   supabase secrets set GEMINI_API_KEY=your-key-here
// Deploy: supabase functions deploy ai-score-answer

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  answerId: string;
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

    const { answerId }: RequestBody = await req.json();
    if (!answerId) {
      return new Response(JSON.stringify({ error: "answerId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Confirm the caller owns (or admins) the test this answer belongs to.
    const { data: answer, error: answerErr } = await admin
      .from("test_submission_answers")
      .select("id, answer_text, question_id, submission_id, test_submissions!inner(test_id)")
      .eq("id", answerId)
      .single();

    if (answerErr || !answer) {
      return new Response(JSON.stringify({ error: "Answer not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const testId = (answer as unknown as { test_submissions: { test_id: string } }).test_submissions.test_id;

    const { data: test } = await admin.from("tests").select("created_by").eq("id", testId).single();
    const { data: caller } = await admin.from("users").select("role").eq("id", userData.user.id).single();
    const isOwner = test?.created_by === userData.user.id;
    const isAdmin = caller?.role === "admin";
    if (!isOwner && !isAdmin) {
      return new Response(JSON.stringify({ error: "Not authorized to review this test" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ score: 0, feedback: "AI scoring unavailable (no API key configured)", confidence: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: question } = await admin
      .from("test_questions")
      .select("text, type, weight, correct_answer, acceptable_answers, rubric")
      .eq("id", answer.question_id)
      .single();

    if (!question) {
      return new Response(JSON.stringify({ error: "Question not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `
Assessment Task: Score a participant's answer to a test question.

Question: ${question.text}
Question Type: ${question.type}
Weight: ${question.weight}
Correct Answer Key/Model: ${question.correct_answer ?? "Not provided"}
Acceptable Alternatives: ${(question.acceptable_answers || []).join(", ") || "None"}
Rubric/Marking Guide: ${question.rubric ?? "Not provided"}

Participant's Answer: "${answer.answer_text ?? ""}"

Instructions:
1. Evaluate the answer based ONLY on the provided key, alternatives, and rubric.
2. Assign a score between 0 and ${question.weight}.
3. Provide a brief rationale for the score.
4. Indicate your confidence level (0.0 to 1.0).
5. If the answer is completely unrelated or you are very uncertain, set confidence low and flag for review.
`.trim();

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                score: { type: "NUMBER" },
                feedback: { type: "STRING" },
                confidence: { type: "NUMBER" },
              },
              required: ["score", "feedback", "confidence"],
            },
          },
        }),
      },
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return new Response(
        JSON.stringify({ score: 0, feedback: "Error during AI assessment", confidence: 0, detail: errText }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const geminiData = await geminiRes.json();
    const textOut = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const result = JSON.parse(textOut);

    const score = result.score ?? 0;
    const feedback = result.feedback ?? "No feedback provided";
    const confidence = result.confidence ?? 0;

    await admin
      .from("test_submission_answers")
      .update({
        awarded_score: score,
        ai_feedback: feedback,
        confidence_score: confidence,
        final_reviewed_score: score,
        final_review_status: "pending",
      })
      .eq("id", answerId);

    return new Response(JSON.stringify({ score, feedback, confidence }), {
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
