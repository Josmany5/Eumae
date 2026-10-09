import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/* The two sentences a caller can be told when a provider fails. Neither is the
 * provider's own words: these end up in front of a person, and Google's error
 * body is written for whoever holds the key — it names endpoints and request
 * ids, and it is not ours to republish. The body itself goes to the function
 * log, where it is actually useful. */
const UPSTREAM_ERROR = 'No reply came back. Try again.';
const EMPTY_REPLY = 'The reply came back empty.';
const SPEAK_FAILED = 'Read aloud failed. Try again.';

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

/* The three models this server can send to, and the reason for each.
 *
 * `auto` is the entry two things read: a request that names no model at all —
 * which is what Auto sends, since `MODEL_KEYS.Auto` is undefined
 * (src/request.ts) — and a request naming something this table does not have.
 * Both chat branches fall back to `MODEL_IDS.auto`, so this line is the answer
 * to "what answers by default", and the owner set it to `gemini-2.5-flash-lite`
 * (2026-10-08): Auto is the quick reply, and Fast and Best are the two rungs
 * above it.
 *
 * One caution belongs beside that choice. Google's deprecation page says the 2.5
 * generation is served only to accounts that used it while it was current — "we
 * are limiting access to the 2.5 models to users who have actively used them in
 * the past" (ai.google.dev/gemini-api/docs/deprecations, read 2026-10-08) — and
 * a project standing up today is exactly the account that never did. That is the
 * note which moved Best off `gemini-2.5-flash` (below). If Auto's first reply
 * fails against the model URL, this is why, and `npm run check:models` with the
 * project's own key says so without sending a message. Fast and Best are both
 * 3.x, so neither depends on that history.
 *
 * `best` was `gemini-2.5-flash`: a model released in June 2025, which Google now
 * serves only to accounts that used the 2.5 generation while it was current,
 * with new projects pointed at 3.5 Flash-Lite or 3.8 Flash. A new deployment is
 * precisely the account that note excludes, so Best would have failed on its
 * first turn, and the label promising the most would have been the one that
 * never answered.
 *
 * `checks/models.mjs` asks Google whether these IDs are still served, so the
 * next retirement is found by running a command rather than by a broken reply.
 */
const MODEL_IDS: Record<string, string> = {
  auto: 'gemini-2.5-flash-lite',
  lite: 'gemini-3.5-flash-lite',
  best: 'gemini-3.8-flash',
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

/** Whether a cross-origin caller is one this endpoint answers.
 *
 *  A browser only sends a preflight, and only reveals the answer, when the page
 *  sits on another origin — the app itself is served by the same project as
 *  this function, so its own calls are same-origin and need none of this. What
 *  is left is the dev case: `npm run dev` on Vite's port talking to a deployed
 *  API. So an origin is answered when it is this very host, or when it is
 *  localhost.
 *
 *  It used to be `*`, which cannot work: a wildcard origin and
 *  `Allow-Credentials: true` contradict each other, and the header list never
 *  mentioned `Authorization` — the one header this endpoint cannot do without.
 *  A browser sent the preflight, read a list without it, and refused to send
 *  the token. Cross-origin sign-in could not have worked. */
function isOurOwnOrigin(origin: string, host: string | undefined): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (host && url.host === host) return true;
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
}

function applyCors(req: VercelRequest, res: VercelResponse): void {
  const origin = req.headers.origin;
  const host = Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host;
  // The answer depends on who asked, so anything caching it must know that.
  res.setHeader('Vary', 'Origin');
  if (typeof origin !== 'string' || !isOurOwnOrigin(origin, host)) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res);

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
      /* The fallback is the table's own `auto` entry rather than a copy of it: a
         literal here is a second thing to remember to change, and one was
         sitting on this line until checks/models.mjs went looking for it. It is
         also what a request with no model at all gets, which is Auto. */
      const modelId = MODEL_IDS[(data as { model?: string }).model || ''] || MODEL_IDS.auto;

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
        const detail = await response.text().catch(() => '');
        console.error('Gemini chat failed:', response.status, detail.slice(0, 500));
        return res.status(502).json({ error: UPSTREAM_ERROR });
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
      /* The fallback is the table's own `auto` entry rather than a copy of it: a
         literal here is a second thing to remember to change, and one was
         sitting on this line until checks/models.mjs went looking for it. It is
         also what a request with no model at all gets, which is Auto. */
      const modelId = MODEL_IDS[(data as { model?: string }).model || ''] || MODEL_IDS.auto;

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
        const detail = await geminiRes.text().catch(() => '');
        console.error('Gemini stream refused:', geminiRes.status, detail.slice(0, 500));
        /* Not one byte has been sent yet, so this is still an ordinary failed
           request: the caller reads it off `res.ok` and never has to hunt for
           an error inside a stream that never opened. */
        return res.status(502).json({ error: UPSTREAM_ERROR });
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      const reader = geminiRes.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let sawDataEvents = false;
      /* What the relay managed to say, and what went wrong if it did. Both
         exist for one reason: a stream that dies halfway must not look like a
         reply that finished. The client is told, inside the stream, that the
         rest is missing. */
      let emittedAnything = false;
      let streamError: string | null = null;
      const extractText = (chunk: { candidates?: { content?: { parts?: { text?: string }[] } }[] }) => {
        const parts = chunk?.candidates?.[0]?.content?.parts || [];
        return parts.map((p) => p?.text || '').join('');
      };
      const emitText = (text: string) => {
        if (!text) return;
        emittedAnything = true;
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
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
        emittedAnything = true;
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
        let chunk: {
          error?: { message?: string; status?: string };
          candidates?: { content?: { parts?: { text?: string; functionCall?: { name?: string; args?: Record<string, unknown> } }[] }; groundingMetadata?: unknown }[];
        };
        try {
          chunk = JSON.parse(payload);
        } catch {
          return;
        }
        /* A stream can fail in the middle, and Gemini reports that the same way
           it reports everything else: as one more event. It used to be parsed
           straight past — an error payload has no `candidates`, so it read as an
           empty chunk, and the reply simply stopped mid-sentence with nothing
           said about it. */
        if (chunk.error) {
          console.error('Gemini stream error event:', JSON.stringify(chunk.error).slice(0, 500));
          streamError = UPSTREAM_ERROR;
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
        streamError = UPSTREAM_ERROR;
      }
      flushOpenCall();
      /* Nothing came back at all and nothing said why. An empty reply is not a
         silent success either. */
      if (!emittedAnything && !streamError) streamError = EMPTY_REPLY;
      if (streamError) res.write(`data: ${JSON.stringify({ error: { message: streamError } })}\n\n`);
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
        /* 200 with no audio is indistinguishable from a working voice that
           chose to say nothing, so nobody can tell whether to fix the deploy or
           to try again. 501 says the server was never given this ability,
           which is exactly what is true. */
        return res.status(501).json({ error: 'Read aloud is not set up on this server.' });
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
          /* A name handed over without a gender — the client sends the name alone
             (src/voices.ts) — gets Google's own for that name, taken from the
             voice list on cloud.google.com/text-to-speech/docs/chirp3-hd (read
             2026-10-08): those sixteen are the male voices of the Chirp 3: HD set
             for en-US, and every other name in it is female. The two branches
             above are for *labels* — `male`, `female`, anything that is not a
             Chirp 3: HD name — and a real name is not one of them, so defaulting
             it to female would make Puck and Fenrir sound like Achernar. */
          ssmlGender = /-(Achird|Algenib|Algieba|Alnilam|Charon|Enceladus|Fenrir|Iapetus|Orus|Puck|Rasalgethi|Sadachbia|Sadaltager|Schedar|Umbriel|Zubenelgenubi)$/.test(
            voiceName || '',
          )
            ? 'MALE'
            : 'FEMALE';
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
          console.error('TTS: Google returned 200 but no audioContent');
          return res.status(502).json({ error: SPEAK_FAILED });
        }
        let errBody = '';
        try { errBody = await ttsResponse.text(); } catch { errBody = '(unreadable)'; }
        console.error('TTS: Google rejected the request, status', ttsResponse.status, 'body:', errBody.substring(0, 500));
      } catch (err) {
        console.error('TTS error:', err);
      }

      return res.status(502).json({ error: SPEAK_FAILED });
    }

    /* A live-voice action (`mintLiveToken`, a Gemini Live session token) used to
       sit here. It is gone because nothing anywhere asked for it: the mockup
       — the design source for this app's voice — has no live session in it at
       all. Its voice is voice *typing* in (1786) and cloud TTS out (1677), and
       this server's `speak` is that TTS. Keeping an endpoint no screen can
       reach is how a deployment grows an attack surface nobody is watching, and
       this one's failure was also the only branch that could not be made honest
       on its own terms — it threw the provider's own text at a 500. */

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

      /* `gemini-2.5-flash-image` carries a shutdown date of March 15, 2027, and
         the same page names this model as its replacement (read 2026-10-08), so
         the countdown is removed now instead of waited out later. */
      const imgRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent?key=${GEMINI_API_KEY}`,
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
    /* Whatever it was, it is ours to read and not the caller's — the messages
       thrown above carry provider status text and provider bodies. */
    console.error('AI API Error:', error);
    return res.status(500).json({ error: 'Something went wrong on the server.' });
  }
}
