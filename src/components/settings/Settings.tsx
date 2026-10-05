import { useEffect, useState } from 'react';
import { Icon } from '../shell/icons';

type View =
  | 'main' | 'personalization' | 'memory' | 'permissions' | 'skills'
  | 'automations' | 'crew' | 'appearance' | 'voice' | 'notifications'
  | 'connectors' | 'usage' | 'datacontrols' | 'storage' | 'help' | 'report';

const TITLES: Record<View, string> = {
  main: 'Settings',
  personalization: 'Personalization',
  memory: 'Memory',
  permissions: 'Permissions',
  skills: 'Skills',
  automations: 'Agents and automation',
  crew: 'Crew',
  appearance: 'Appearance',
  voice: 'Voice',
  notifications: 'Notifications',
  connectors: 'Connectors',
  usage: 'Usage',
  datacontrols: 'Data controls',
  storage: 'Storage',
  help: 'Help',
  report: 'Report a problem',
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
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark');
  const [voice, setVoice] = useStored('voice', 'Nova');
  const [notif, setNotif] = useStored('notif', { allow: true, proposals: true });
  const [websearch, setWebsearch] = useStored('skill-websearch', true);
  const [style, setStyle] = useStored('personalization', '');
  const [draft, setDraft] = useState('');
  const [report, setReport] = useState('');

  useEffect(() => {
    if (open) setView('main');
  }, [open ]);

  const pickTheme = (t: string) => {
    setTheme(t);
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem('eumae-theme', t);
    } catch {
      /* storage unavailable */
    }
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

  const wipeData = () => {
    if (window.confirm('Delete everything?')) {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('eumae:')) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
      location.reload();
    }
  };

  const back = () => (view === 'main' ? onClose() : setView('main'));

  return (
    <div className={`settings${open ? ' open' : ''}`}>
      <div className="shead">
        <button className="hb" onClick={back} aria-label="Back">
          <Icon name="bk" />
        </button>
        <div className="tt">{TITLES[view]}</div>
        <div style={{ width: 40 }} />
      </div>
      <div className="sbody">
        {view === 'main' && (
          <>
            <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div className="fi" style={{ borderRadius: '50%', fontSize: 15 }}>G</div>
              <div className="g"><b>Guest</b><div className="xs m">not signed in</div></div>
              <button className="fb" onClick={() => notify('Profile editor arrives in a later stage')}>Edit</button>
            </div>
            <Group title="Eumae">
              <Row icon="str" title="Personalization" onClick={() => setView('personalization')} />
              <Row icon="db" title="Memory" value={`${mems.length} saved`} onClick={() => setView('memory')} />
              <Row icon="chk" title="Permissions" onClick={() => setView('permissions')} />
              <Row icon="zap" title="Skills" onClick={() => setView('skills')} />
              <Row icon="clk" title="Agents and automation" value={`${autos.length}`} onClick={() => setView('automations')} />
              <Row icon="chat" title="Crew" onClick={() => setView('crew')} />
            </Group>
            <Group title="App">
              <Row icon="img" title="Appearance" value={theme === 'dark' ? 'Dark' : 'Light'} onClick={() => setView('appearance')} />
              <Row icon="mic" title="Voice" value={voice} onClick={() => setView('voice')} />
              <Row icon="bel" title="Notifications" value={notif.allow ? 'On' : 'Off'} onClick={() => setView('notifications')} />
              <Row icon="lnk" title="Connectors" value="2 connected" onClick={() => setView('connectors')} />
            </Group>
            <Group title="Data">
              <Row icon="zap" title="Usage" value="$0.00" onClick={() => setView('usage')} />
              <Row icon="db" title="Data controls" onClick={() => setView('datacontrols')} />
              <Row icon="fol" title="Storage" onClick={() => setView('storage')} />
            </Group>
            <Group title="Support">
              <Row icon="chat" title="Help" onClick={() => notify('Help center arrives in a later stage')} />
              <Row icon="doc" title="Report a problem" onClick={() => setView('report')} />
              <Row icon="doc" title="About" onClick={() => notify('Eumae 0.1')} />
            </Group>
            <div className="btns">
              <button className="gho" style={{ color: 'var(--rd)' }} onClick={() => notify('Sign-in arrives in a later stage')}>Sign out</button>
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
          <div className="sg">
            {['Nova', 'Alloy', 'Onyx', 'Shimmer'].map((v) => (
              <button className="sr" key={v} onClick={() => setVoice(v)}>
                <span className="g">{v}</span>
                {v === voice ? <span className="ch" style={{ color: 'var(--ac)' }}>✓</span> : null}
              </button>
            ))}
          </div>
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

        {view === 'datacontrols' && (
          <div className="btns">
            <button onClick={exportData}>Export my data</button>
            <button className="gho" style={{ color: 'var(--rd)' }} onClick={wipeData}>Delete everything</button>
          </div>
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
      </div>
    </div>
  );
}
