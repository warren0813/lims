// Post-login landing — minimal shell + welcome panel per role.
// This is the "foundation" frame the rest of the product will fit into.

const PostLogin = ({ user, onLogout }) => {
  const isFab = user.role === 'fab_user';

  // Nav items for each role (taken from shell.jsx contracts)
  const labNav = [
    { id: 'dashboard',  label: 'Dashboard',  cn: '儀表板',  icon: 'Home' },
    { id: 'samples',    label: 'Samples',    cn: '樣品',    icon: 'Flask' },
    { id: 'wip',        label: 'WIP',        cn: '在製',    icon: 'WIP' },
    { id: 'dispatches', label: 'Dispatches', cn: '派工',    icon: 'Dispatch' },
    { id: 'equipment',  label: 'Equipment',  cn: '設備',    icon: 'Equipment' },
  ];
  const fabNav = [
    { id: 'fab_dashboard', label: 'Dashboard',   cn: '儀表板',   icon: 'Home' },
    { id: 'fab_requests',  label: 'My Requests', cn: '我的申請', icon: 'ClipboardList' },
    { id: 'fab_drafts',    label: 'Drafts',      cn: '草稿',     icon: 'FilePlus' },
    { id: 'fab_new',       label: 'New Request', cn: '新申請',   icon: 'Plus' },
  ];
  const navItems = isFab ? fabNav : labNav;
  const [active, setActive] = React.useState(navItems[0].id);

  const route = { page: active };
  const navigate = (r) => setActive(r.page);

  const { Sidebar, TopBar } = window.SHELL;
  const { Card, SectionLabel, Badge, Button, IDChip } = window.UI;

  // Today date for header chrome
  const today = '2026-05-11';

  // Welcome content per role
  const heroTitle = isFab
    ? `Welcome back, ${user.display}`
    : `Welcome back, ${user.display}`;
  const heroSub = isFab
    ? `${today} · 廠區使用者 — overview of your commission requests`
    : `${today} · 實驗室成員每日工作台`;

  // Foundation status: which pages exist as scaffolds
  const foundation = isFab
    ? [
        { label: 'Dashboard',   cn: '儀表板',   status: 'created',  note: 'Welcome glance + open requests' },
        { label: 'My Requests', cn: '我的申請', status: 'created',  note: 'Filterable list, status pipeline' },
        { label: 'Drafts',      cn: '草稿',     status: 'pending',  note: 'Saved-but-unsubmitted commissions' },
        { label: 'New Request', cn: '新申請',   status: 'pending',  note: 'Multi-section form, sample table' },
        { label: 'Request detail · #', cn: '申請詳情', status: 'pending', note: 'Approval history + run progress' },
      ]
    : [
        { label: 'Dashboard',   cn: '儀表板',   status: 'created',  note: 'Today\'s queue + activity feed' },
        { label: 'Samples',     cn: '樣品',     status: 'created',  note: 'Receive / reject incoming wafers' },
        { label: 'WIP',         cn: '在製',     status: 'pending',  note: 'Work-in-progress experiments' },
        { label: 'Dispatches',  cn: '派工',     status: 'pending',  note: 'Equipment dispatch queue' },
        { label: 'Equipment',   cn: '設備',     status: 'pending',  note: 'Tool status + utilization' },
      ];

  return (
    <div className="app">
      <Sidebar
        route={route}
        navigate={navigate}
        counts={{}}
        user={user}
        onLogout={onLogout}
        navItems={navItems}
        sectionLabel={isFab ? 'Requests' : 'Lab Operations'}
      />
      <main className="main">
        <TopBar
          title={heroTitle}
          subtitle={heroSub}
          right={
            isFab ? (
              <Button variant="dark" icon={<I.Plus/>}>New Request</Button>
            ) : (
              <>
                <Button variant="secondary" icon={<I.Inbox/>}>Bulk receive</Button>
                <Button variant="dark" icon={<I.Plus/>}>Receive samples</Button>
              </>
            )
          }
        />

        <div style={{ padding: '24px 32px 48px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Foundation banner */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 14,
            padding: '14px 16px', borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(244,168,191,0.08) 0%, rgba(187,183,232,0.08) 100%)',
            border: '1px solid rgba(108,103,184,0.20)',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: 'linear-gradient(135deg, #f4a8bf 0%, #bbb7e8 100%)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(244,168,191,0.35)',
            }}><I.Flask size={16} color="#1e1e24"/></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                Foundation · 基礎架構
              </div>
              <div style={{ marginTop: 3, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Login + role-aware shell are wired up. You're signed in as <code style={{ background: '#ebebf0', padding: '1px 6px', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{user.username}</code> ({user.subtitle}).
                Sidebar nav, top bar, and design tokens are live — the role split routes you to the right surface on sign-in.
              </div>
            </div>
            <Badge status="in_progress" label="In Progress"/>
          </div>

          {/* Two columns: identity + roadmap */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
            {/* Roadmap card */}
            <Card>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <SectionLabel>Pages · 頁面</SectionLabel>
                  <div style={{ marginTop: 6, fontSize: 15.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {isFab ? 'Fab user surface' : 'Lab operator surface'}
                  </div>
                </div>
                <Badge status="created" label={`${foundation.length} screens`}/>
              </div>
              <div>
                {foundation.map((p, i) => (
                  <div key={p.label} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 20px',
                    borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                    transition: 'background 0.12s',
                  }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-row-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                      background: p.status === 'created' ? 'rgba(108,103,184,0.10)' : '#f1f1f5',
                      color: p.status === 'created' ? 'var(--accent-link)' : 'var(--text-muted)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {p.status === 'created' ? <I.CircleCheck size={15}/> : <I.Clock size={14}/>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{p.label}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· {p.cn}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>{p.note}</div>
                    </div>
                    <Badge status={p.status} label={p.status === 'created' ? 'Scaffolded' : 'Not built'}/>
                  </div>
                ))}
              </div>
            </Card>

            {/* Identity / role card */}
            <Card>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <SectionLabel>Session · 工作階段</SectionLabel>
                <div style={{ marginTop: 6, fontSize: 15.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Signed in
                </div>
              </div>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 999,
                    background: isFab
                      ? 'var(--tweak-fab-bg, linear-gradient(135deg, #f4a8bf, #bbb7e8))'
                      : 'linear-gradient(135deg, #f4a8bf, #bbb7e8)',
                    color: '#fff', fontSize: 17, fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>{user.display[0].toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>{user.username}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>{user.subtitle}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <KV label="Role"           value={<IDChip id={user.role} prefix="" size="sm"/>}/>
                  <KV label="Theme"          value="Lab night sky · 夜空主題"/>
                  <KV label="Default route"  value={<IDChip id={navItems[0].id} prefix="/" size="sm"/>}/>
                  <KV label="Date"           value={<span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5 }}>{today}</span>}/>
                </div>

                <Button variant="secondary" icon={<I.LogOut/>} onClick={onLogout} style={{ width: '100%' }}>Sign out</Button>
              </div>
            </Card>
          </div>

          {/* Token strip — proves design tokens load */}
          <Card>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <SectionLabel>Design tokens · 設計代幣</SectionLabel>
              <div style={{ marginTop: 6, fontSize: 13.5, color: 'var(--text-secondary)' }}>
                Pulled from <code style={{ background: '#ebebf0', padding: '1px 6px', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>colors_and_type.css</code>. Every page below this foundation uses the same tokens.
              </div>
            </div>
            <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
              {[
                { name: 'primary',  swatch: '#1e1e24', sub: 'Sidebar · ink' },
                { name: 'lavender', swatch: '#bbb7e8', sub: 'Active accent' },
                { name: 'pink',     swatch: '#f4a8bf', sub: 'Logo gradient' },
                { name: 'violet',   swatch: '#6c67b8', sub: 'Running · links' },
                { name: 'teal',     swatch: '#9ebbc8', sub: 'Receive accents' },
                { name: 'app bg',   swatch: '#f7f8fa', sub: 'Page background', dark: true },
              ].map(t => (
                <div key={t.name} style={{
                  border: '1px solid var(--border)', borderRadius: 10, padding: 12,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                    background: t.swatch,
                    border: t.dark ? '1px solid var(--border)' : 'none',
                  }}/>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>{t.swatch}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 1 }}>{t.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

const KV = ({ label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 12.5 }}>
    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
    <span style={{ color: 'var(--text-primary)' }}>{value}</span>
  </div>
);

window.PostLogin = PostLogin;
