import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  app.post('/api/analyze-report', async (req, res) => {
    try {
      const { reportText, fileBase64, mimeType, patientContext } = req.body;

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];

      if (fileBase64 && mimeType) {
        parts.push({
          inlineData: {
            data: fileBase64,
            mimeType,
          },
        });
      }

      const promptText = `You are a clinical biomarker analyst and preventive medicine nutritionist.
Analyze the provided health lab report and patient context, then produce a structured JSON response containing:
1. Extracted biomarkers with exact numeric values, units, reference ranges, status ("Normal", "Borderline", or "Attention"), organSystem ("Metabolic", "Cardiovascular", "Micronutrient", "Thyroid & Hepatic"), plain-English clinicalInsight, and rootCauseMechanism.
2. Overall clinical condition summary and biological priority focus.
3. Personalized Chrono-Nutrition Diet Protocol (4 timed daily meals where each meal specifically targets the out-of-range biomarkers with exact nutrient pairings and bioavailability notes).
4. Personalized Movement & Exercise Prescription (3 targeted training sessions calibrated to the patient's cardiovascular, glycemic, and inflammatory markers, including heart rate zone, duration, and joint/fatigue guardrails).
5. Recommended Medication & Supplement Circadian Schedule (with exact timing, food/absorption synergy, and drug-nutrient conflict warnings).
6. Recommended Specialist Type and Diagnostic Follow-up based on the findings.

Patient Context: ${patientContext || 'Adult preventive diagnostic panel'}
Lab Report Content: ${reportText || 'Analyze the attached diagnostic report image/document.'}`;

      parts.push({ text: promptText });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reportTitle: { type: Type.STRING },
              summaryHeadline: { type: Type.STRING },
              conditionOverview: { type: Type.STRING },
              recommendedSpecialistCategory: { type: Type.STRING },
              biomarkers: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    name: { type: Type.STRING },
                    value: { type: Type.NUMBER },
                    unit: { type: Type.STRING },
                    referenceRange: { type: Type.STRING },
                    status: { type: Type.STRING },
                    organSystem: { type: Type.STRING },
                    clinicalInsight: { type: Type.STRING },
                    targetAction: { type: Type.STRING },
                  },
                  required: [
                    'id',
                    'name',
                    'value',
                    'unit',
                    'referenceRange',
                    'status',
                    'organSystem',
                    'clinicalInsight',
                    'targetAction',
                  ],
                },
              },
              dietPlan: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    timeWindow: { type: Type.STRING },
                    mealName: { type: Type.STRING },
                    dishTitle: { type: Type.STRING },
                    targetedBiomarkers: { type: Type.STRING },
                    macros: { type: Type.STRING },
                    bioavailabilityRule: { type: Type.STRING },
                    ingredients: { type: Type.STRING },
                  },
                  required: [
                    'id',
                    'timeWindow',
                    'mealName',
                    'dishTitle',
                    'targetedBiomarkers',
                    'macros',
                    'bioavailabilityRule',
                    'ingredients',
                  ],
                },
              },
              exercisePlan: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    sessionTitle: { type: Type.STRING },
                    cadence: { type: Type.STRING },
                    durationMinutes: { type: Type.NUMBER },
                    heartRateZone: { type: Type.STRING },
                    targetedBiomarkerMechanism: { type: Type.STRING },
                    protocolSteps: { type: Type.STRING },
                    safetyGuardrail: { type: Type.STRING },
                  },
                  required: [
                    'id',
                    'sessionTitle',
                    'cadence',
                    'durationMinutes',
                    'heartRateZone',
                    'targetedBiomarkerMechanism',
                    'protocolSteps',
                    'safetyGuardrail',
                  ],
                },
              },
              suggestedMedications: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    dosage: { type: Type.STRING },
                    scheduledTime: { type: Type.STRING },
                    circadianWindow: { type: Type.STRING },
                    foodInstruction: { type: Type.STRING },
                    interactionWarning: { type: Type.STRING },
                    linkedBiomarker: { type: Type.STRING },
                  },
                  required: [
                    'name',
                    'dosage',
                    'scheduledTime',
                    'circadianWindow',
                    'foodInstruction',
                    'interactionWarning',
                    'linkedBiomarker',
                  ],
                },
              },
            },
            required: [
              'reportTitle',
              'summaryHeadline',
              'conditionOverview',
              'recommendedSpecialistCategory',
              'biomarkers',
              'dietPlan',
              'exercisePlan',
              'suggestedMedications',
            ],
          },
        },
      });

      const text = response.text;
      if (!text) {
        res.status(500).json({ error: 'Empty response from clinical analysis model.' });
        return;
      }

      const parsed = JSON.parse(text.trim());
      res.json(parsed);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to analyze health report.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/n8n-chat', async (req, res) => {
    try {
      const { chatInput, sessionId, action = 'sendMessage', metadata } = req.body || {};
      const n8nUrl =
        'https://harshitha39.app.n8n.cloud/webhook/90bab5af-e28b-4460-b3b3-40029d90c209/chat';

      const response = await fetch(n8nUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/plain, */*',
        },
        body: JSON.stringify({
          action,
          sessionId: sessionId || 'vitalsense-session-1',
          chatInput: chatInput || '',
          metadata: metadata || {},
        }),
      });

      const rawText = await response.text();
      let data: unknown = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        data = { output: rawText };
      }

      if (!response.ok) {
        res.status(response.status).json({
          error: `n8n webhook returned status ${response.status}`,
          details: data,
        });
        return;
      }

      res.json(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to connect to n8n chatbot.';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
