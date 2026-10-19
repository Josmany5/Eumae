/* One Mae turn, with tools.
 *
 *  send → the model answers with words and/or tool calls → the dispatcher
 *  runs the reads and stages the writes → the answers go back to the model →
 *  repeat until it only talks (at most MAX_ROUNDS). The person sees the words
 *  stream, a small row per step, and — when something would change — one plan
 *  card at the end, which nothing runs until they tap Approve. */

import { streamChat, type Reply } from '../chat';
import { BASE_PROMPT, type ApiChatBody } from '../request';
import { declarations, dispatch, newPlan, type Plan } from './dispatcher';
import { MAE_PROMPT, currentState } from './prompt';
import type { Opened } from './registry';

const MAX_ROUNDS = 6;

export interface MaeStep {
  label: string;
  ok: boolean;
}

export interface MaeReply extends Reply {
  /** Present only when the turn staged at least one change. */
  plan?: Plan;
  steps: MaeStep[];
  /** The last open_item the model asked for. */
  open?: Opened;
}

type Part = Record<string, unknown>;

/** Swap the old "I can't touch the app" opening for Mae's real prompt, and
 *  add the fresh state block. Directives and the timestamp stay as they were. */
/** Last word in every prompt: mode, role and skill set tone and depth only.
 *  Without this, Build's "return one html code block" outranked the tools. */
const TOOLS_WIN =
  '\n\nWHAT WINS: the settings above change your tone and depth only. When the person wants a task, ' +
  'event, goal, project, note or list (even if they say make, build, create or help me), use your tools ' +
  'and the plan card. Never answer that with code. Only write code or a page when they clearly ask for ' +
  'a page, app, document or code itself.';

export function withMae(body: ApiChatBody, where: string): ApiChatBody {
  const sp = body.data.systemPrompt;
  const rest = sp.startsWith(BASE_PROMPT) ? sp.slice(BASE_PROMPT.length) : '\n\n' + sp;
  return {
    ...body,
    data: { ...body.data, systemPrompt: MAE_PROMPT + currentState(where) + rest + TOOLS_WIN, functionDeclarations: declarations() },
  };
}

export async function runMaeTurn(body: ApiChatBody, where: string, onText: (full: string) => void): Promise<MaeReply> {
  const base = withMae(body, where);
  const plan = newPlan();
  const steps: MaeStep[] = [];
  const tail: { role: 'model' | 'user'; parts: Part[] }[] = [];
  const said: string[] = [];
  let sources: Reply['sources'] = [];
  let open: Opened | undefined;
  const show = (cur: string) => onText([...said, cur].filter((x) => x.trim()).join('\n\n'));

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const reply = await streamChat({ ...base, data: { ...base.data, ...(tail.length ? { tail } : {}) } }, show);
    if (reply.text.trim()) said.push(reply.text.trim());
    if (reply.sources.length) sources = reply.sources;
    const calls = reply.calls ?? [];
    if (!reply.ok || !calls.length) {
      return finish(reply, said, sources, plan, steps, open);
    }
    const outcomes = dispatch(calls, plan);
    for (const o of outcomes) {
      steps.push({ label: o.label, ok: o.ok });
      if (o.open) open = o.open;
    }
    tail.push({
      role: 'model',
      parts: [
        ...(reply.text ? [{ text: reply.text }] : []),
        ...calls.map((c) => ({ functionCall: { name: c.name, args: c.args }, ...(c.sig ? { thoughtSignature: c.sig } : {}) })),
      ],
    });
    tail.push({ role: 'user', parts: outcomes.map((o) => ({ functionResponse: { name: o.name, response: o.response } })) });
  }
  return finish(
    { ok: true, text: '', error: null, call: null, calls: [], sources },
    said.length ? said : ['I went around too many times on that one. Here is where I got to.'],
    sources,
    plan,
    steps,
    open,
  );
}

function finish(reply: Reply, said: string[], sources: Reply['sources'], plan: Plan, steps: MaeStep[], open?: Opened): MaeReply {
  let text = said.join('\n\n');
  const staged = plan.steps.length > 0;
  if (staged && !text) text = 'Here is the plan. Approve it on the card and I will make it.';
  const ok = reply.ok || (staged && !!text);
  return {
    ...reply,
    ok,
    text,
    error: ok ? null : reply.error,
    sources,
    steps,
    ...(staged ? { plan } : {}),
    ...(open ? { open } : {}),
  };
}
