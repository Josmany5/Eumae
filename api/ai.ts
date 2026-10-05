import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

interface Attachment {
  mimeType: string;
  data: string;
}

function sanitizeAttachments(attachments: unknown): { inlineData: { mimeType: string; data: string } }[] {
  if (!Array.isArray(attachments)) return [];
  const parts: { inlineData: { mimeType: string; data: string } }[] = [];
  let totalBytes = 0;
  const MAX_TOTAL_BYTES = 3 * 1024 * 1024;
  for (const a of attachments as Attachment[]) {
    if (!a || typeof a.mimeType !== 'string' || typeof a.data !== 'string') continue;
    const mimeType = a.mimeType.toLowerCase().trim();
    if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf' && mimeType !== 'text/plain') continue;
    if (!/^[A-Za-z0-9+/=]+$/.test(a.data) || a.data.length < 100) continue;
    if (totalBytes + a.data.length > MAX_TOTAL_BYTES) break;
    totalBytes += a.data.length;
    parts.push({ inlineData: { mimeType, data: a.data } });
  }
  return parts;
}

async function verifyCaller(req: VercelRequest): Promise<string | null> {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase is not configured');
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  const supabase = createClient(url, anonKey);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

const MODEL_IDS: Record<string, string> = {
  lite: 'gemini-3.5-flash-lite',
  best: 'gemini-2.5-flash',
};

interface ChatMessage {
  role: string;
  content: string;
}

function buildContents(message: string, conversationHistory: ChatMessage[] | undefined, attachments: unknown) {
  const contents: { role: string; parts: unknown[] }[] = [];
  if (conversationHistory && conversationHistory.length > 0) {
    for (const msg of conversationHistory) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }
  }
  contents.push({
    role: 'user',
    parts: [{ text: message }, ...sanitizeAttachments(attachments)],
  });
  return contents;
}

function buildGeminiBody(
  systemPrompt: string,
  message: string,
  conversationHistory: ChatMessage[] | undefined,
  attachments: unknown,
  functionDeclarations: unknown[] | undefined
) {
  const combineTools = Array.isArray(functionDeclarations) && functionDeclarations.length > 0;
  return {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: buildContents(message, conversationHistory, attachments),
    tools: [
      { google_search: {} },
      ...(combineTools ? [{ function_declarations: functionDeclarations }] : []),
    ],
    ...(combineTools ? { toolConfig: { includeServerSideToolInvocations: true } } : {}),
    generationConfig: { temperature: 0.7, maxOutputTokens: 16384 },
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // The lock: every action requires a signed-in caller. Unsigned calls are
  // rejected before the API key is ever touched.
  let callerId: string | null;
  try {
    callerId = await verifyCaller(req);
  } catch {
    return res.status(500).json({ error: 'Sign-in service is not configured' });
  }
  if (!callerId) {
    return res.status(401).json({ error: 'Sign in required' });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const GOOGLE_CLOUD_TTS_KEY = process.env.GOOGLE_CLOUD_TTS_KEY;

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API key not configured' });
  }

  try {
    const { action, data } = req.body as { action: string; data: Record<string, unknown> };

    if (action === 'chat') {
      const { systemPrompt, conversationHistory, message, attachments, functionDeclarations } = data as {
        systemPrompt: string;
        conversationHistory?: ChatMessage[];
        message: string;
        attachments?: unknown;
        functionDeclarations?: unknown[];
        model?: string;
      };
      const modelId = MODEL_IDS[(data as { model?: string }).model || ''] || 'gemini-3.5-flash-lite';

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            buildGeminiBody(systemPrompt, message, conversationHistory, attachments, functionDeclarations)
          ),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.statusText} - ${errorText}`);
      }

      const result = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string; functionCall?: { name: string; args: unknown } }[] }; groundingMetadata?: unknown }[];
        usageMetadata?: { cachedContentTokenCount?: number; promptTokenCount?: number };
      };
      const parts = (result.candidates?.[0]?.content?.parts) || [];
      const aiResponse = parts.map((p) => p?.text || '').join('');
      const functionCalls = parts
        .filter((p) => p?.functionCall)
        .map((p) => ({ name: p.functionCall!.name, args: p.functionCall!.args || {} }));

      const usage = result.usageMetadata || {};
      const grounding = result.candidates?.[0]?.groundingMetadata || null;
      return res.status(200).json({
        response: aiResponse,
        functionCalls,
        usage: {
          cachedTokens: usage.cachedContentTokenCount || 0,
          inputTokens: usage.promptTokenCount || 0,
        },
        grounding,
      });
    }

    if (action === 'chatStream') {
      const { systemPrompt, conversationHistory, message, attachments, functionDeclarations } = data as {
        systemPrompt: string;
        conversationHistory?: ChatMessage[];
        message: string;
        attachments?: unknown;
        functionDeclarations?: unknown[];
        model?: string;
      };
      const modelId = MODEL_IDS[(data as { model?: string }).model || ''] || 'gemini-3.5-flash-lite';

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            buildGeminiBody(systemPrompt, message, conversationHistory, attachments, functionDeclarations)
          ),
        }
      );

      if (!geminiRes.ok || !geminiRes.body) {
        const errorText = await geminiRes.text().catch(() => '');
        return res.status(502).json({ error: `Gemini stream error: ${geminiRes.statusText} - ${errorText}` });
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      const reader = geminiRes.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let sawDataEvents = false;
      const extractText = (chunk: { candidates?: { content?: { parts?: { text?: string }[] } }[] }) => {
        const parts = chunk?.candidates?.[0]?.content?.parts || [];
        return parts.map((p) => p?.text || '').join('');
      };
      const emitText = (text: string) => {
        if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
      };
      let openCall: { name: string; args: Record<string, unknown> } | null = null;
      let streamGrounding: unknown = null;
      const mergeArgs = (target: Record<string, unknown>, src: Record<string, unknown>) => {
        for (const k of Object.keys(src || {})) {
          const a = target[k];
          const b = src[k];
          if (typeof a === 'string' && typeof b === 'string') target[k] = a + b;
          else if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b))
            mergeArgs(a as Record<string, unknown>, b as Record<string, unknown>);
          else target[k] = b;
        }
      };
      const emitFunctionCall = (call: { name: string; args: Record<string, unknown> }) => {
        res.write(`data: ${JSON.stringify({ functionCall: { name: call.name, args: call.args } })}\n\n`);
      };
      const flushOpenCall = () => {
        if (openCall) {
          emitFunctionCall(openCall);
          openCall = null;
        }
      };
      const handleFunctionCallParts = (parts: { text?: string; functionCall?: { name?: string; args?: Record<string, unknown> } }[]) => {
        for (const p of parts) {
          if (p?.text) { flushOpenCall(); continue; }
          if (!p?.functionCall) continue;
          const fc = p.functionCall;
          if (!fc.name) { flushOpenCall(); continue; }
          if (openCall && openCall.name !== fc.name) flushOpenCall();
          if (!openCall) openCall = { name: fc.name, args: {} };
          mergeArgs(openCall.args, fc.args || {});
        }
      };
      const handlePayload = (payload: string) => {
        if (!payload || payload === '[DONE]') return;
        let chunk: { candidates?: { content?: { parts?: { text?: string; functionCall?: { name?: string; args?: Record<string, unknown> } }[] }; groundingMetadata?: unknown }[] };
        try {
          chunk = JSON.parse(payload);
        } catch {
          return;
        }
        const c = chunk?.candidates?.[0];
        const parts = c?.content?.parts || [];
        if (c?.groundingMetadata) streamGrounding = c.groundingMetadata;
        handleFunctionCallParts(parts);
        emitText(extractText(chunk));
      };
      const drainEvents = () => {
        let idx: number;
        while ((idx = buf.indexOf('\n\n')) !== -1) {
          const rawEvent = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const dataLines: string[] = [];
          for (const line of rawEvent.split('\n')) {
            if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
          }
          if (dataLines.length) {
            sawDataEvents = true;
            handlePayload(dataLines.join('\n'));
          }
        }
      };
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
          drainEvents();
        }
        buf += decoder.decode().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        drainEvents();
        if (!sawDataEvents && buf.trim()) {
          const text = buf.trim();
          let depth = 0, inStr = false, esc = false, start = -1;
          for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (inStr) {
              if (esc) esc = false;
              else if (ch === '\\') esc = true;
              else if (ch === '"') inStr = false;
            } else if (ch === '"') {
              inStr = true;
            } else if (ch === '{') {
              if (depth === 0) start = i;
              depth++;
            } else if (ch === '}') {
              depth--;
              if (depth === 0 && start !== -1) {
                try {
                  emitText(extractText(JSON.parse(text.slice(start, i + 1))));
                } catch { /* skip malformed piece */ }
                start = -1;
              }
            }
          }
        }
      } catch (e) {
        console.error('chatStream relay error:', e);
      }
      flushOpenCall();
      if (streamGrounding) res.write(`data: ${JSON.stringify({ grounding: streamGrounding })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    }

    if (action === 'speak') {
      const { text, voice = 'female', voiceGender, rate } = data as {
        text: string;
        voice?: string;
        voiceGender?: string;
        rate?: string;
      };
      let speakingRate = parseFloat(rate || '');
      if (!isFinite(speakingRate)) speakingRate = 1.0;
      speakingRate = Math.min(4.0, Math.max(0.25, speakingRate));
      const serverStart = Date.now();

      if (!GOOGLE_CLOUD_TTS_KEY) {
        return res.status(200).json({ audio: null });
      }

      try {
        const cleanedText = text
          .replace(/\*\*/g, '')
          .replace(/\*/g, '')
          .replace(/_/g, '')
          .replace(/`/g, '')
          .replace(/#{1,6}\s/g, '')
          .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
          .trim();

        let voiceName = voice;
        let ssmlGender = voiceGender;
        if (voice === 'male') {
          voiceName = 'en-US-Chirp3-HD-Achird';
          ssmlGender = 'MALE';
        } else if (!voice || voice === 'female' || (typeof voice === 'string' && !voice.startsWith('en-US-Chirp3-HD-'))) {
          voiceName = 'en-US-Chirp3-HD-Achernar';
          ssmlGender = 'FEMALE';
        }
        if (ssmlGender !== 'MALE' && ssmlGender !== 'FEMALE') {
          ssmlGender = /-(Achird|Algieba|Alnilam)$/.test(voiceName || '') ? 'MALE' : 'FEMALE';
        }

        const googleStart = Date.now();
        const ttsResponse = await fetch(
          `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_CLOUD_TTS_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input: { text: cleanedText },
              voice: { languageCode: 'en-US', name: voiceName, ssmlGender },
              audioConfig: { audioEncoding: 'MP3', speakingRate, pitch: 0.0 },
            }),
          }
        );
        const googleMs = Date.now() - googleStart;

        if (ttsResponse.ok) {
          const result = (await ttsResponse.json()) as { audioContent?: string };
          if (result.audioContent) {
            return res.status(200).json({
              audio: result.audioContent,
              mimeType: 'audio/mpeg',
              timing: { serverMs: Date.now() - serverStart, googleMs },
            });
          }
          console.error('TTS diagnostic: Google returned 200 but no audioContent');
        } else {
          let errBody = '';
          try { errBody = await ttsResponse.text(); } catch { errBody = '(unreadable)'; }
          console.error('TTS diagnostic: Google rejected request, status', ttsResponse.status, 'body:', errBody.substring(0, 500));
        }
      } catch (err) {
        console.error('TTS error:', err);
      }

      return res.status(200).json({ audio: null });
    }

    if (action === 'mintLiveToken') {
      const now = Date.now();
      const tokenResponse = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/auth_tokens',
        {
          method: 'POST',
          headers: {
            'x-goog-api-key': GEMINI_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            uses: 1,
            expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
            newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
          }),
        }
      );

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Token mint failed: ${tokenResponse.statusText} - ${errorText}`);
      }

      const tokenResult = (await tokenResponse.json()) as { name?: string };
      if (!tokenResult.name) {
        throw new Error('Token endpoint returned no token name');
      }
      return res.status(200).json({ token: tokenResult.name });
    }

    if (action === 'generateImage') {
      const { prompt, aspectRatio, images } = (data || {}) as {
        prompt?: string;
        aspectRatio?: string;
        images?: { mimeType?: string; data?: string }[];
      };
      const cleanPrompt = typeof prompt === 'string' ? prompt.trim().slice(0, 2000) : '';
      if (!cleanPrompt) {
        return res.status(400).json({ error: 'Missing image prompt' });
      }
      const inputImages = Array.isArray(images)
        ? images.filter((i) => i && typeof i.data === 'string' && (i.data as string).length > 0).slice(0, 4)
        : [];
      const inputBytes = inputImages.reduce((n, i) => n + Math.ceil(((i.data as string) || '').length * 3 / 4), 0);
      if (inputBytes > 15 * 1024 * 1024) {
        return res.status(400).json({ error: 'Those images are too large (over ~15MB). Try a smaller image.' });
      }
      const validRatios = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
      const ratio = validRatios.includes(aspectRatio || '') ? aspectRatio : undefined;

      const imgRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                ...inputImages.map((i) => ({ inlineData: { mimeType: i.mimeType || 'image/png', data: i.data } })),
                { text: cleanPrompt },
              ],
            }],
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE'],
              ...(ratio ? { imageConfig: { aspectRatio: ratio } } : {}),
            },
          }),
        }
      );
      if (!imgRes.ok) {
        const errorText = await imgRes.text();
        throw new Error(`Image model error: ${imgRes.statusText} - ${errorText}`);
      }
      const imgResult = (await imgRes.json()) as {
        candidates?: { content?: { parts?: { text?: string; inlineData?: { mimeType?: string; data?: string } }[] } }[];
      };
      const imgParts = imgResult.candidates?.[0]?.content?.parts || [];
      const imgPart = imgParts.find(
        (p) => p?.inlineData?.data && /^image\//.test(p.inlineData.mimeType || '')
      );
      if (!imgPart?.inlineData) {
        const said = imgParts.map((p) => p?.text || '').join('').trim();
        return res.status(502).json({
          error: said
            ? `The image model declined: ${said.slice(0, 300)}`
            : 'The image model returned no image.',
        });
      }
      return res.status(200).json({
        image: {
          mimeType: imgPart.inlineData.mimeType || 'image/png',
          data: imgPart.inlineData.data,
        },
      });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    console.error('AI API Error:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
}
