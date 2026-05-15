import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      this.genAI = new GoogleGenerativeAI(key);
    } else {
      this.logger.warn('GEMINI_API_KEY not set — AI feedback disabled');
    }
  }

  async generateChallenge(difficulty: 'easy' | 'medium' | 'hard', category?: string): Promise<{
    title: string; description: string; category: string;
    test_cases: { input: string; expected_output: string; is_sample: boolean; explanation?: string }[];
  } | null> {
    if (!this.genAI) return null;
    const prompt = `Generate a unique competitive programming challenge.
Difficulty: ${difficulty}
Category: ${category || 'any (arrays, strings, math, sorting, dp, graphs, etc.)'}

Respond ONLY in this exact JSON format (no markdown):
{
  "title": "Short descriptive title",
  "description": "Full problem statement. Explain input format (read from stdin), constraints, and output format. Be precise about newlines and whitespace.",
  "category": "category name",
  "test_cases": [
    {"input": "exact stdin input", "expected_output": "exact stdout output", "is_sample": true, "explanation": "why this is the answer"},
    {"input": "another input", "expected_output": "another output", "is_sample": true},
    {"input": "edge case input", "expected_output": "edge output", "is_sample": false},
    {"input": "harder input", "expected_output": "harder output", "is_sample": false},
    {"input": "stress input", "expected_output": "stress output", "is_sample": false}
  ]
}`;
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const json = text.replace(/^```json?\s*/i, '').replace(/```$/, '').trim();
      return JSON.parse(json);
    } catch (err) {
      this.logger.error('Gemini generate error', err.message);
      return null;
    }
  }

  async generateFeedback(params: {
    challengeTitle: string;
    challengeDescription: string;
    language: string;
    code: string;
    status: string;
    score: number;
    passed: number;
    total: number;
    testResults: { test_case: number; passed: boolean; stdout?: string; expected?: string }[];
  }): Promise<{ overall: string; what_went_well: string; what_went_wrong: string; corrections: string[]; tip: string } | null> {
    if (!this.genAI) return null;

    const { challengeTitle, challengeDescription, language, code, status, score, passed, total, testResults } = params;

    const failedTests = testResults.filter(r => !r.passed);
    const failedSummary = failedTests.map(r =>
      `Test ${r.test_case}: got "${r.stdout ?? 'no output'}", expected "${r.expected ?? 'hidden'}"`
    ).join('\n');

    const prompt = `You are a coding mentor reviewing a student's submission.

Challenge: ${challengeTitle}
Description: ${challengeDescription}

Language: ${language}
Score: ${score}/100 (${passed}/${total} test cases passed)
Status: ${status}

Student's code:
\`\`\`${language}
${code}
\`\`\`

${failedTests.length > 0 ? `Failed test cases:\n${failedSummary}` : 'All test cases passed!'}

Respond ONLY in this exact JSON format (no markdown, no extra text):
{
  "overall": "one sentence summary of their performance",
  "what_went_well": "what they did correctly (1-2 sentences)",
  "what_went_wrong": "what caused failures, or empty string if all passed",
  "corrections": ["step 1 to fix the issue", "step 2", "step 3"],
  "tip": "one short pro tip to improve their solution"
}`;

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const json = text.replace(/^```json?\s*/i, '').replace(/```$/,'').trim();
      return JSON.parse(json);
    } catch (err) {
      this.logger.error('Gemini feedback error', err.message);
      return null;
    }
  }
}
