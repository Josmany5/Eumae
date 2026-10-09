import { useEffect, useState } from 'react';
import { Icon } from '../shell/icons';
import { LOG_AREAS, useLog, type LogArea } from '../../log';
import { useMedia } from '../../useMedia';
import { speak } from '../../voice';
import { DEFAULT_VOICE, VOICES, voiceById } from '../../voices';
import { createAccount, emailLink, signIn, signOutUser, useAuth } from '../../auth';

// Who the cards show when nobody is signed in. The placeholder is deliberate: this
// file is public and the app is deployed, so a real name or address must never be
// written here — and now that `src/auth.ts` exists, the signed-in address is the one
// Supabase holds rather than a value typed into this file. The avatar derives from
// whichever name is in use, so the rail card and the phone card cannot drift apart.
const ACCOUNT = { name: 'Guest', email: 'Not signed in — this device only' };

/* What the Voice pane's sample says. The mockup's button exists (613, 692) but
   only toasts "Playing sample…" — the one thing a sample button must not do. The
   words are ours, and they are the only thing a sample can honestly be: a
   sentence about what the voice is for, in the voice you chose. */
const VOICE_SAMPLE = 'This is how I sound when I read an answer aloud.';

type View =
  | 'main' | 'personalization' | 'memory' | 'permissions' | 'skills'
  | 'automations' | 'crew' | 'appearance' | 'language' | 'accessibility'
  | 'voice' | 'notifications' | 'connectors' | 'billing' | 'security'
  | 'usage' | 'logs' | 'datacontrols' | 'storage'
  | 'help' | 'report' | 'legal' | 'about';

const TITLES: Record<View, string> = {
  main: 'Settings',
  personalization: 'Personalization',
  memory: 'Memory',
  permissions: 'Permissions',
  skills: 'Skills',
  automations: 'Agents and automation',
  crew: 'Crew',
  appearance: 'Appearance',
  language: 'Language and region',
  accessibility: 'Accessibility',
  voice: 'Voice',
  notifications: 'Notifications',
  connectors: 'Connectors',
  billing: 'Billing',
  security: 'Security',
  usage: 'Usage',
  logs: 'Logs',
  datacontrols: 'Data controls',
  storage: 'Storage',
  help: 'Help',
  report: 'Report a problem',
  legal: 'Legal',
  about: 'About',
};

function useStored<T>(key: string, initial: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(() => {
    try {
      const raw = localStorage.getItem('eumae:' + key);
      return raw != null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = (v: T) => {
    setVal(v);
    try {
      localStorage.setItem('eumae:' + key, JSON.stringify(v));
    } catch {
      /* storage unavailable */
    }
  };
  return [val, set];
}

function Row({ icon, title, value, onClick }: { icon: string; title: string; value?: string; onClick: () => void }) {
  return (
    <button className="sr" onClick={onClick}>
      <Icon name={icon} />
      <span className="g">{title}</span>
      {value ? <span className="v m">{value}</span> : null}
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h3 className="sec">{title}</h3>
      <div className="sg">{children}</div>
    </>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return <button className={`tg${on ? ' on' : ''}`} onClick={onClick} aria-label={label} />;
}

/* Language and region is a read-out, not a picker. Nothing here is typed in:
   the only honest source for a locale is the browser's own, so the label, the
   region name and the sample date are all derived from it. Translations are a
   separate job — when they land, this page grows a real selector. */
function localeFacts() {
  let tag = 'en-US';
  try {
    tag = navigator.language || tag;
  } catch {
    /* no navigator — server render, tests */
  }
  const parts = tag.split('-');
  const region = (parts[1] || 'US').toUpperCase();
  try {
    const languages = new Intl.DisplayNames([tag], { type: 'language' });
    const regions = new Intl.DisplayNames([tag], { type: 'region' });
    return {
      label: `${languages.of(parts[0]) || 'English'} (${region})`,
      region: regions.of(region) || region,
      date: new Intl.DateTimeFormat(tag, { dateStyle: 'medium' }).format(new Date()),
    };
  } catch {
    return { label: 'English (US)', region: 'United States', date: new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date()) };
  }
}

const LANG_FACTS = localeFacts();

interface Mem { id: string; t: string }
interface Auto { id: string; n: string; w: string; on: boolean }

const CREW: { n: string; s: string; d: string }[] = [
  { n: 'Watcher', s: 'proposed', d: 'Watches inbox, calendar, tasks — cut for YC' },
  { n: 'Teller', s: 'proposed', d: 'Composes the briefings — cut for YC' },
  { n: 'Compiler', s: 'proposed', d: 'Builds each request from explicit UI state' },
  { n: 'Dispatcher', s: 'locked', d: 'Validates and runs tool calls' },
  { n: 'Bouncer', s: 'proposed', d: 'Permission checks — never infers intent' },
  { n: 'Librarian', s: 'exploratory', d: 'The only writer — files everything' },
  { n: 'Cartographer', s: 'exploratory', d: 'Maps mentions, flags drift' },
  { n: 'Analyzer', s: 'open', d: 'Scores the crew — not yet a decision' },
];

const GRANT_LABELS: Record<string, string> = {
  edit: 'Edit',
  file: 'File',
  calendar: 'Calendar',
  email: 'Email',
  delete: 'Delete',
};

interface SettingsProps {
  open: boolean;
  onClose: () => void;
  notify: (msg: string) => void;
}

export default function Settings({ open, onClose, notify }: SettingsProps) {
  const [view, setView] = useState<View>('main');
  const [mems, setMems] = useStored<Mem[]>('mems', []);
  const [grants, setGrants] = useStored<Record<string, string>>('grants', {
    edit: 'always', file: 'always', calendar: 'ask', email: 'never', delete: 'never',
  });
  const [autos, setAutos] = useStored<Auto[]>('autos', [
    { id: 'a1', n: 'Morning brief', w: 'Weekdays 7:00 AM', on: true },
    { id: 'a2', n: 'Shutdown ritual', w: 'Daily 9:00 PM', on: true },
  ]);
  // Appearance is stored like every other preference (`eumae:theme`), which is
  // what puts it in a backup and lets Delete everything clear it. The default is
  // whatever boot applied in index.html — when nothing is stored yet, that value
  // already followed the OS, so the pane can't disagree with the screen.
  const [theme, setTheme] = useStored('theme', document.documentElement.dataset.theme || 'dark');
  /* The voice is stored as the name a request sends (`voices.ts`) rather than as
     the row's label: the old value was the mockup's `Nova`, which this server
     cannot speak, and `voiceById` turns anything it does not recognise into the
     default — so an install that chose one of the four old names reads as the
     default voice now, and never fails. */
  const [voice, setVoice] = useStored('voice', DEFAULT_VOICE.id);
  const [notif, setNotif] = useStored('notif', { allow: true, proposals: true });
  const [websearch, setWebsearch] = useStored('skill-websearch', true);
  const [style, setStyle] = useStored('personalization', '');
  const [draft, setDraft] = useState('');
  const [report, setReport] = useState('');
  // The four accessibility switches. Only "Reduce motion" has a writer today:
  // the type scale is px-based, so larger/bold text are stored preferences the
  // pane admits are not applied yet, and voice answers wait on replies.
  const [a11y, setA11y] = useStored('a11y', { larger: false, bold: false, reduce: false, voice: true });
  const [logArea, setLogArea] = useState<LogArea>('All');
  // Which pill is lit is view state and is never stored; the list it filters
  // lives in src/log.ts, which is not Settings' to keep.
  const logRows = useLog(logArea);

  /* Who is signed in (src/auth.ts). Three things in this file read it — the two
     account cards and the Security pane — which is why that state lives in its
     own module instead of here. */
  const account = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Mobile: a full-page sheet opened from the list. Desktop: a modal whose left
  // rail *is* the list, so it opens on the first section instead.
  const isDesktop = useMedia('(min-width:900px)');

  useEffect(() => {
    if (open) setView(isDesktop ? 'personalization' : 'main');
  }, [open, isDesktop]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Reduce motion is the one accessibility switch that needs no new design
  // language: tokens.css reads the attribute and flattens every transition.
  useEffect(() => {
    if (a11y.reduce) document.documentElement.dataset.motion = 'reduce';
    else delete document.documentElement.dataset.motion;
  }, [a11y.reduce]);

  const pickTheme = (t: string) => {
    setTheme(t);
    document.documentElement.dataset.theme = t;
  };

  const exportData = () => {
    const data: Record<string, string | null> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('eumae:')) data[k] = localStorage.getItem(k);
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'eumae-data.json';
    a.click();
    URL.revokeObjectURL(a.href);
    notify('Export ready');
  };

  const wipeData = async () => {
    if (!window.confirm('Delete everything? This erases what is stored on this device and signs you out.')) return;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('eumae:')) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    /* The session is not an `eumae:` key — the library keeps it under its own
       name — so deleting the prefixed keys alone would leave someone signed in
       with everything else gone. "Everything" has to mean everything. */
    await signOutUser();
    location.reload();
  };

  const back = () => (isDesktop || view === 'main' ? onClose() : setView('main'));
  const onBackdrop = (e: React.MouseEvent) => {
    if (isDesktop && e.target === e.currentTarget) onClose();
  };
  /* Signing out is real as of the sign-in screen. It is deliberately not written
     to the activity log: every area in `src/log.ts` belongs to a tab, and an
     account is not one — a row about credentials does not belong in a log about
     conversations. */
  const signOut = async () => {
    await signOutUser();
    notify('Signed out');
  };

  /* One runner for the three things this pane can do. Each answers `null` for
     success and one sentence otherwise (src/auth.ts), and the sentence is shown
     in the pane rather than in a toast: a toast is gone in two seconds and a
     wrong password is worth being able to read twice. */
  const attempt = async (what: () => Promise<string | null>, done: string) => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const problem = await what();
    setBusy(false);
    setNote(problem ?? done);
  };

  // One source for both the mobile list and the desktop rail.
  const sections: { group: string; items: { key: View; icon: string; title: string; value?: string }[] }[] = [
    {
      group: 'Eumae',
      items: [
        { key: 'personalization', icon: 'str', title: 'Personalization' },
        { key: 'memory', icon: 'db', title: 'Memory', value: `${mems.length} saved` },
        { key: 'permissions', icon: 'chk', title: 'Permissions' },
        { key: 'skills', icon: 'zap', title: 'Skills' },
        { key: 'automations', icon: 'clk', title: 'Agents and automation', value: `${autos.length}` },
        { key: 'crew', icon: 'chat', title: 'Crew' },
      ],
    },
    {
      group: 'App',
      items: [
        { key: 'appearance', icon: 'img', title: 'Appearance', value: theme === 'dark' ? 'Dark' : 'Light' },
        { key: 'voice', icon: 'mic', title: 'Voice', value: voiceById(voice).name },
        { key: 'notifications', icon: 'bel', title: 'Notifications', value: notif.allow ? 'On' : 'Off' },
        { key: 'connectors', icon: 'lnk', title: 'Connectors', value: '2 connected' },
        { key: 'language', icon: 'globe', title: 'Language and region', value: LANG_FACTS.label },
        { key: 'accessibility', icon: 'acc', title: 'Accessibility' },
      ],
    },
    // Account holds the rows that only mean something once there is an account.
    // They read as unbuilt today ("Free", no password) rather than as a fake
    // profile — the mockup's Security page invents a password, a passkey and two
    // sessions, which is the one thing we can't ship.
    {
      group: 'Account',
      items: [
        { key: 'billing', icon: 'bill', title: 'Billing', value: 'Free' },
        { key: 'security', icon: 'shield', title: 'Security' },
      ],
    },
    {
      group: 'Data',
      items: [
        { key: 'usage', icon: 'zap', title: 'Usage', value: '$0.00' },
        { key: 'logs', icon: 'clk', title: 'Logs' },
        { key: 'datacontrols', icon: 'db', title: 'Data controls' },
        { key: 'storage', icon: 'fol', title: 'Storage' },
      ],
    },
    {
      group: 'Support',
      items: [
        { key: 'help', icon: 'chat', title: 'Help' },
        { key: 'report', icon: 'doc', title: 'Report a problem' },
        { key: 'legal', icon: 'law', title: 'Legal' },
        // About was a stray group of its own with a toast for a door. It belongs
        // beside Help and Legal, and it can carry the version as a real page.
        { key: 'about', icon: 'str', title: 'About', value: 'Eumae 0.1' },
      ],
    },
  ];

  /* What both cards show. The signed-in address is whatever Supabase holds; the
     placeholder only covers the state before there is one. */
  const accountName = account.email ? account.email.split('@')[0] || account.email : ACCOUNT.name;
  const accountEmail = account.email ?? ACCOUNT.email;
  const accountInitial = accountName.slice(0, 1).toUpperCase();
  const signedIn = account.status === 'signed-in';

  return (
    <div className={`settings${open ? ' open' : ''}`} onClick={onBackdrop}>
      <div className="smodal">
        {isDesktop && (
          <aside className="stabs">
            <div className="stAccount">
              <div className="fi av">{accountInitial}</div>
              <div className="g">
                <b>{accountName}</b>
                <div className="xs m">{accountEmail}</div>
              </div>
            </div>
            <div className="stScroll">
              {sections.map((s) => (
                <div key={s.group}>
                  <div className="stGroup">{s.group}</div>
                  {s.items.map((it) => (
                    <button
                      key={it.key}
                      className={`stab${view === it.key ? ' on' : ''}`}
                      onClick={() => setView(it.key)}
                    >
                      <Icon name={it.icon} />
                      <span className="g">{it.title}</span>
                      {it.value ? <span className="v">{it.value}</span> : null}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            {/* The rail's foot button says what it will actually do. It used to
                offer "Sign out" to somebody who had never signed in. */}
            <div className="stFoot">
              {signedIn ? (
                <button className="stab danger" onClick={signOut}>Sign out</button>
              ) : (
                <button className="stab" onClick={() => setView('security')}>Sign in</button>
              )}
            </div>
          </aside>
        )}

        <div className="spanel">
          <div className="shead">
            <button className="hb" onClick={back} aria-label={isDesktop ? 'Close' : 'Back'}>
              <Icon name={isDesktop ? 'x' : 'bk'} />
            </button>
            <div className="tt">{TITLES[view]}</div>
            <div className="sp" />
          </div>
          <div className="sbody">
            {view === 'main' && !isDesktop && (
              <>
                <div className="card acctCard">
                  <div className="fi av">{accountInitial}</div>
                  <div className="g"><b>{accountName}</b><div className="xs m">{accountEmail}</div></div>
                  {/* The card's own door. The mockup's opened a profile editor;
                      with no account there is nothing to edit, so it opens the
                      sign-in screen instead — the one thing in this app that
                      turns the AI on (src/auth.ts). */}
                  <button className="fb" onClick={() => setView('security')}>
                    {signedIn ? 'Account' : 'Sign in'}
                  </button>
                </div>
                {sections.map((s) => (
                  <Group key={s.group} title={s.group}>
                    {s.items.map((it) => (
                      <Row key={it.key} icon={it.icon} title={it.title} value={it.value} onClick={() => setView(it.key)} />
                    ))}
                  </Group>
                ))}
                <div className="btns">
                  {signedIn ? (
                    <button className="gho" style={{ color: 'var(--rd)' }} onClick={signOut}>Sign out</button>
                  ) : (
                    <button className="pri" onClick={() => setView('security')}>Sign in</button>
                  )}
                </div>
              </>
            )}

        {view === 'personalization' && (
          <div className="card">
            <div className="s m" style={{ marginBottom: 8 }}>How should Eumae talk to you?</div>
            <input className="sinput" placeholder="e.g. blunt, short, no fluff" value={style} onChange={(e) => setStyle(e.target.value)} />
            <div className="btns">
              <button className="pri" onClick={() => { notify('Saved'); setView('main'); }}>Save</button>
            </div>
          </div>
        )}

        {view === 'memory' && (
          <>
            <div className="card" style={{ padding: '6px 14px' }}>
              {mems.length === 0 ? (
                <div className="s m">Nothing saved yet.</div>
              ) : (
                mems.map((x) => (
                  <div className="gr" key={x.id}>
                    <div className="g">{x.t}</div>
                    <button className="fb gho" style={{ color: 'var(--rd)' }} onClick={() => setMems(mems.filter((y) => y.id !== x.id))}>Forget</button>
                  </div>
                ))
              )}
            </div>
            <div className="card">
              <input className="sinput" placeholder="Teach Eumae something…" value={draft} onChange={(e) => setDraft(e.target.value)} />
              <div className="btns">
                <button className="pri" onClick={() => {
                  if (draft.trim()) {
                    setMems([...mems, { id: 'm' + Date.now(), t: draft.trim() }]);
                    setDraft('');
                  }
                }}>Teach Eumae</button>
              </div>
            </div>
          </>
        )}

        {view === 'permissions' && (
          <>
            <div className="card" style={{ padding: '6px 14px' }}>
              {Object.entries(grants).map(([k, v]) => (
                <div className="gr" key={k}>
                  <div className="g" style={{ textTransform: 'capitalize' }}><b>{GRANT_LABELS[k] || k}</b></div>
                  <select value={v} onChange={(e) => { setGrants({ ...grants, [k]: e.target.value }); notify('Permission updated'); }}>
                    {['never', 'ask', 'always'].map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="s m">"Never delete files" is a standing never — revoke the delete grant and files can't be deleted, ever.</div>
          </>
        )}

        {view === 'skills' && (
          <>
            <div className="card" style={{ padding: '6px 14px' }}>
              <div className="gr">
                <div className="g"><b>Web search</b></div>
                <Toggle on={websearch} onClick={() => setWebsearch(!websearch)} label="Web search" />
              </div>
            </div>
            <div className="s m">Skills are the AI's tools. More installable later.</div>
          </>
        )}

        {view === 'automations' && (
          <>
            <div className="card" style={{ padding: '6px 14px' }}>
              {autos.map((x) => (
                <div className="gr" key={x.id}>
                  <div className="g"><b>{x.n}</b><div className="xs m">{x.w}</div></div>
                  <Toggle on={x.on} onClick={() => setAutos(autos.map((y) => (y.id === x.id ? { ...y, on: !y.on } : y)))} label={x.n} />
                </div>
              ))}
            </div>
            <div className="btns">
              <button className="pri" onClick={() => notify('Automations arrive in a later stage')}>New automation</button>
            </div>
          </>
        )}

        {view === 'crew' && (
          <>
            <div className="card" style={{ padding: '6px 14px' }}>
              {CREW.map((x) => (
                <div className="gr" key={x.n}>
                  <div className="g"><b>{x.n}</b><div className="xs m">{x.d}</div></div>
                  <span className={`tag${x.s === 'locked' ? ' gr' : x.s === 'proposed' ? ' am' : ''}`}>{x.s}</span>
                </div>
              ))}
            </div>
            <div className="s m">One Eumae on the surface — the crew is code underneath.</div>
          </>
        )}

        {view === 'appearance' && (
          <div className="seg" style={{ padding: '12px 16px' }}>
            <button className={theme === 'dark' ? 'on' : ''} onClick={() => pickTheme('dark')}>Dark</button>
            <button className={theme === 'light' ? 'on' : ''} onClick={() => pickTheme('light')}>Light</button>
          </div>
        )}

        {view === 'voice' && (
          <>
            <div className="sg">
              {VOICES.map((v) => (
                <button className="sr" key={v.id} onClick={() => setVoice(v.id)}>
                  <span className="g">
                    {v.name}
                    {/* Google gives a voice a name, a gender and a recording, and
                        nothing else — so the row says those two facts and where the
                        name comes from, and the sample button below is where "how
                        does it sound" is answered. */}
                    <div className="d">
                      {v.gender} · {v.about}
                    </div>
                  </span>
                  {v.id === voice ? <span className="ch" style={{ color: 'var(--ac)' }}>✓</span> : null}
                </button>
              ))}
            </div>
            {/* Where `.btns` sits in the mockup (613): outside the list, its own
                row, one primary button. It speaks in the row that is ticked, which
                is the difference between this button and the mockup's: that one
                said "Playing sample…" and played the same voice whichever row you
                had chosen, because no voice name ever left the browser (1681). */}
            <div className="btns">
              <button className="pri" onClick={() => speak(VOICE_SAMPLE, notify, voiceById(voice).id)}>
                Play sample
              </button>
            </div>
            <div className="s m" style={{ marginTop: 8 }}>
              Read aloud uses the voice that is ticked. These six are part of Google&apos;s Chirp 3: HD set —
              the voices its speech API offers for US English — and every one of them is named after a star,
              a moon or a figure from myth.
            </div>
          </>
        )}

        {view === 'notifications' && (
          <div className="card" style={{ padding: '6px 14px' }}>
            <div className="gr">
              <div className="g"><b>Allow notifications</b></div>
              <Toggle on={notif.allow} onClick={() => setNotif({ ...notif, allow: !notif.allow })} label="Allow notifications" />
            </div>
            <div className="gr">
              <div className="g"><b>Proposal alerts</b><div className="xs m">Notify when a proposal is ready for your call</div></div>
              <Toggle on={notif.proposals} onClick={() => setNotif({ ...notif, proposals: !notif.proposals })} label="Proposal alerts" />
            </div>
          </div>
        )}

        {view === 'connectors' && (
          <>
            <div className="sg">
              <div className="sr"><Icon name="lnk" /><span className="g">Gmail</span><span className="v m">connected</span></div>
              <div className="sr"><Icon name="cal" /><span className="g">Google Calendar</span><span className="v m">connected</span></div>
            </div>
            <div className="btns">
              <button className="pri" onClick={() => notify('Connectors arrive in a later stage')}>Add connector</button>
            </div>
          </>
        )}

        {view === 'usage' && (
          <div className="card">
            <div className="row"><div className="g"><b>This month</b><div className="xs m">Cheap prompts, full receipts.</div></div><b>$0.00</b></div>
            <div className="bar"><i style={{ width: '0%' }} /></div>
            <div className="xs m">$20.00 typical — transparency only, never blocking.</div>
            <div className="btns">
              <button className="gho" onClick={() => notify('Receipts arrive in a later stage')}>Export receipts</button>
            </div>
          </div>
        )}

        {/* The mockup settles this one: both its rows call goPage('sDat') — the
            Account row "Export and backup" and the Data row "Data controls" open
            the same pane, titled "Data controls"
            (eumae-mockup-wove-branch.html:1436, the live settings list; the pane it
            lands on is pgSDat at 696). Two rows pointing at one pane is two doors
            to one room, which is this project's recurring bug class, so the second
            row is gone rather than kept as an alias — and the backup card that used
            to sit behind it moved in here, where the export action already lived. */}
        {view === 'datacontrols' && (
          <>
            <div className="card" style={{ padding: '6px 14px' }}>
              <div className="kv"><span className="m">What a backup holds</span><span>Everything Eumae keeps</span></div>
              <div className="kv"><span className="m">Where it goes</span><span>A file you keep</span></div>
            </div>
            <div className="btns">
              <button onClick={exportData}>Export my data</button>
              <button className="gho" onClick={() => notify('Restoring from a file arrives in a later stage')}>Restore from a file</button>
              <button className="gho" style={{ color: 'var(--rd)' }} onClick={wipeData}>Delete everything</button>
            </div>
            <div className="s m">One plain JSON file, written on this device. Nothing is uploaded.</div>
          </>
        )}

        {view === 'storage' && (
          <div className="card" style={{ padding: '6px 14px' }}>
            <div className="kv"><span className="m">Things remembered</span><span>{mems.length} items</span></div>
            <div className="kv"><span className="m">Device</span><span>Local only</span></div>
          </div>
        )}

        {view === 'help' && (
          <>
            <div className="sg">
              <Row icon="chat" title="How Chat modes work" onClick={() => notify('Ask, Build, Learn — Eumae switches, you can override')} />
              <Row icon="chat" title="Where do files live?" onClick={() => notify('Library — one true home per file')} />
              <Row icon="chat" title="What is the Guild handshake?" onClick={() => notify('Nothing sends until you say so')} />
            </div>
            <div className="btns">
              <button className="pri" onClick={() => notify('Support chat arrives in a later stage')}>Contact support</button>
            </div>
          </>
        )}

        {view === 'report' && (
          <div className="card">
            <input className="sinput" placeholder="What went wrong?" value={report} onChange={(e) => setReport(e.target.value)} />
            <div className="btns">
              <button className="pri" onClick={() => { setReport(''); notify('Reports arrive in a later stage'); }}>Send</button>
            </div>
          </div>
        )}
        {view === 'language' && (
          <>
            <div className="sg">
              <div className="sr">
                <Icon name="globe" />
                <span className="g">{LANG_FACTS.label}</span>
                <span className="v m">selected</span>
              </div>
            </div>
            <div className="card" style={{ padding: '6px 14px' }}>
              <div className="kv"><span className="m">Region</span><span>{LANG_FACTS.region}</span></div>
              <div className="kv"><span className="m">Date format</span><span>{LANG_FACTS.date}</span></div>
            </div>
            <div className="s m">Read from your browser — there is nothing to change yet. More languages arrive with translations.</div>
          </>
        )}

        {view === 'accessibility' && (
          <>
            <div className="card" style={{ padding: '6px 14px' }}>
              <div className="gr">
                <div className="g"><b>Larger text</b></div>
                <Toggle on={a11y.larger} onClick={() => setA11y({ ...a11y, larger: !a11y.larger })} label="Larger text" />
              </div>
              <div className="gr">
                <div className="g"><b>Bold text</b></div>
                <Toggle on={a11y.bold} onClick={() => setA11y({ ...a11y, bold: !a11y.bold })} label="Bold text" />
              </div>
              <div className="gr">
                <div className="g"><b>Reduce motion</b><div className="xs m">Calms the widget jiggle and page swipes</div></div>
                <Toggle on={a11y.reduce} onClick={() => setA11y({ ...a11y, reduce: !a11y.reduce })} label="Reduce motion" />
              </div>
              <div className="gr">
                <div className="g"><b>Voice answers</b><div className="xs m">Read replies aloud</div></div>
                <Toggle on={a11y.voice} onClick={() => setA11y({ ...a11y, voice: !a11y.voice })} label="Voice answers" />
              </div>
            </div>
            <div className="s m">Reduce motion applies right away — every sheet, chip and fade stops moving. The type scale is rebuilt before larger and bold text can mean anything, and voice answers need replies to read.</div>
          </>
        )}

        {view === 'billing' && (
          <div className="card">
            <div className="row">
              <div className="g"><b>Eumae Free</b><div className="xs m">Everything on while we build.</div></div>
              <b>$0</b>
            </div>
            <div className="bar"><i style={{ width: '0%' }} /></div>
            <div className="xs m">No charge today. Model spend lives in Usage — shown, never blocking.</div>
            <div className="btns">
              <button className="pri" onClick={() => notify('Checkout opens at launch')}>Upgrade at launch</button>
            </div>
          </div>
        )}

        {view === 'security' && (
          <>
            <div className="card" style={{ padding: '6px 14px' }}>
              <div className="kv">
                <span className="m">Signed in as</span>
                <span>
                  {signedIn
                    ? account.email
                    : account.status === 'checking'
                      ? 'Checking…'
                      : account.status === 'unconfigured'
                        ? 'Nothing to sign in to'
                        : 'No one yet'}
                </span>
              </div>
              <div className="kv"><span className="m">Where your work lives</span><span>Local only</span></div>
            </div>

            {/* The mockup's Security page invents a password, a passkey and two
                active sessions (1039). This is the same pane without the fiction:
                the state that is actually true, and the one control this app has
                that a person needs — the door itself. */}
            {account.status === 'unconfigured' ? (
              <div className="s m">
                This build has no sign-in configured, so it cannot reach its own server. It was built
                without VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY — both belong in the
                deployment's environment, and a build reads them as it is built.
              </div>
            ) : signedIn ? (
              <>
                <div className="btns">
                  <button className="gho" style={{ color: 'var(--rd)' }} onClick={signOut}>Sign out</button>
                </div>
                <div className="s m">
                  Resetting a password by email, two-factor and a list of active sessions are not
                  built yet. No password is stored on this device: the session is kept by Supabase in
                  this browser, and signing out is the only way to end it here.
                </div>
              </>
            ) : (
              <>
                <div className="card">
                  <input
                    className="sinput"
                    type="email"
                    value={email}
                    placeholder="you@example.com"
                    autoComplete="email"
                    aria-label="Email"
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <input
                    className="sinput"
                    type="password"
                    value={password}
                    placeholder="Password"
                    autoComplete="current-password"
                    aria-label="Password"
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <div className="btns">
                    <button
                      className="pri"
                      disabled={busy || !email.trim() || !password}
                      onClick={() => attempt(() => signIn(email, password), 'Signed in')}
                    >
                      Sign in
                    </button>
                    <button
                      disabled={busy || !email.trim() || !password}
                      onClick={() => attempt(() => createAccount(email, password), 'Account created — you are signed in')}
                    >
                      Create account
                    </button>
                  </div>
                  <div className="btns">
                    <button
                      className="gho"
                      disabled={busy || !email.trim()}
                      onClick={() => attempt(() => emailLink(email), 'Check your email for the link')}
                    >
                      Email me a link instead
                    </button>
                  </div>
                </div>
                {note ? <div className="s m">{note}</div> : null}
                <div className="s m">
                  Eumae's server answers a signed-in person and nobody else — that check is the first
                  thing it does, before it reads any key. So this is the one screen that turns the AI
                  on, for chat and for read aloud both. Passwords are Supabase's; nothing here stores
                  one.
                </div>
              </>
            )}
          </>
        )}

        {view === 'logs' && (
          <>
            <div className="ftabs">
              {LOG_AREAS.map((a) => (
                <button key={a} className={logArea === a ? 'on' : ''} onClick={() => setLogArea(a)}>{a}</button>
              ))}
            </div>
            <div className="card" style={{ padding: '6px 14px' }}>
              {/* The real log (src/log.ts), filtered by the pill you're on. The
                  mockup seeded invented rows here (line 1435); this pane shows
                  what actually happened, and stays empty — in its own words —
                  until something does. */}
              {logRows.length ? (
                logRows.map((l) => (
                  <div className="hi" key={l.id}>
                    <span className={`dt ${l.status}`} />
                    <div className="s">
                      {l.text}
                      <div className="xs m">{l.area} · {l.ts}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="s m">Nothing logged here yet.</div>
              )}
            </div>
            <div className="s m" style={{ marginTop: 8 }}>One log, filtered by area. It lives in this session — nothing is stored or exported yet.</div>
          </>
        )}

        {view === 'legal' && (
          <>
            <div className="sg">
              <Row icon="law" title="Terms of service" onClick={() => notify('Terms publish with the first release')} />
              <Row icon="law" title="Privacy policy" onClick={() => notify('The privacy policy publishes with the first release')} />
              <Row icon="law" title="Licenses" onClick={() => notify('Open-source licenses publish with the first release')} />
            </div>
            <div className="s m" style={{ marginTop: 8 }}>Eumae 0.1 · Your data stays yours.</div>
          </>
        )}

        {view === 'about' && (
          <>
            <div className="card" style={{ padding: '6px 14px' }}>
              <div className="kv"><span className="m">Version</span><span>0.1</span></div>
              <div className="kv"><span className="m">Stage</span><span>Building</span></div>
              <div className="kv"><span className="m">Your data</span><span>Local only</span></div>
            </div>
            <div className="s m">One window: Chat, Console, Studio, Library, Classroom and Guild — six views on one app.</div>
          </>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}
