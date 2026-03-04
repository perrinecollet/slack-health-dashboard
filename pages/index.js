import { useState, useEffect, useCallback } from "react";

const VALID_PREFIXES = [
  "bizops-","compliance-","corecliot-","cs-","dataplat-","dlm-","finance-",
  "hardware-","hr-","marketing-","netsec-","ops-","plateng-","sales-",
  "talent-acquisition-","product-","safety-","waste-","legal-","proj-",
  "ext-","help-","intel-","social-","temp-","taskforce-","coreplat-",
  "delivery-","foundation-","hardprod-","softprod-","revenue-","tech-","org-",
  "general","random"
];

function isCompliant(ch) {
  return ch.namingOk && ch.hasTopic;
}

const pct = (n, d) => d === 0 ? 0 : Math.round(n / d * 100);
const sc = (v) => v >= 80 ? "#22c55e" : v >= 50 ? "#f59e0b" : "#ef4444";

function KpiCard({ icon, label, value, sub, color = "#6366f1" }) {
  return (
    <div style={{ background: "#1e1e2e", borderRadius: 14, padding: "16px 18px", border: "1px solid #2d2d44" }}>
      <div style={{ fontSize: 20 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#a0a0bf", marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: "#6b6b8a", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Badge({ ok, label }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 20, background: ok ? "#14532d" : "#450a0a", color: ok ? "#4ade80" : "#f87171", border: `1px solid ${ok ? "#166534" : "#7f1d1d"}` }}>
      {label}
    </span>
  );
}

function Bar({ value, max = 100, color = "#6366f1" }) {
  return (
    <div style={{ background: "#2d2d44", borderRadius: 99, height: 5, width: "100%" }}>
      <div style={{ background: color, borderRadius: 99, height: 5, width: `${Math.min(100, pct(value, max))}%`, transition: "width .5s" }} />
    </div>
  );
}

function Spinner() {
  return <div style={{ display: "inline-block", width: 16, height: 16, border: "2px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />;
}

export default function App() {
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLog, setActionLog] = useState([]);
  const [expandedCh, setExpandedCh] = useState(null);
  const [expandedMb, setExpandedMb] = useState(null);
  const [expandedGdm, setExpandedGdm] = useState(null);
  const [expandedUg, setExpandedUg] = useState(null);
  const [chFilter, setChFilter] = useState("all");
  const [chSearch, setChSearch] = useState("");
  const [mbSort, setMbSort] = useState("mentions3m");

  const addLog = (m) => setActionLog(p => [`[${new Date().toLocaleTimeString()}] ${m}`, ...p].slice(0, 30));

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/slack");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setData(json);
      addLog(`✅ Données mises à jour — ${json.channels?.length} channels, ${json.people?.length} membres`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const doArchive = async (channelId, channelName) => {
    try {
      const res = await fetch(`/api/slack?action=archive&channelId=${channelId}`);
      const json = await res.json();
      if (json.ok) addLog(`🗄️ #${channelName} archivé avec succès`);
      else addLog(`❌ Erreur archivage #${channelName}`);
    } catch { addLog(`❌ Erreur archivage #${channelName}`); }
  };

  const doNotify = async (channelId, message, label) => {
    try {
      const res = await fetch(`/api/slack?action=notify&channelId=${channelId}&message=${encodeURIComponent(message)}`);
      const json = await res.json();
      if (json.ok) addLog(`📩 Message envoyé : ${label}`);
      else addLog(`❌ Erreur envoi message`);
    } catch { addLog(`❌ Erreur envoi message`); }
  };

  if (loading && !data) {
    return (
      <div style={{ background: "#0d0d1a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#e2e2f0", fontFamily: "Inter,sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <Spinner />
          <div style={{ marginTop: 16, fontSize: 14, color: "#a0a0bf" }}>Connexion à Slack en cours…</div>
          <div style={{ marginTop: 6, fontSize: 11, color: "#6b6b8a" }}>Récupération des channels, membres et statistiques</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: "#0d0d1a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#e2e2f0", fontFamily: "Inter,sans-serif" }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>❌</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Erreur de connexion Slack</div>
          <div style={{ fontSize: 12, color: "#f87171", background: "#450a0a", padding: "8px 16px", borderRadius: 8, marginBottom: 16 }}>{error}</div>
          <div style={{ fontSize: 12, color: "#6b6b8a", marginBottom: 16 }}>Vérifiez que la variable <code>SLACK_BOT_TOKEN</code> est bien configurée dans Vercel.</div>
          <button onClick={fetchData} style={{ background: "#6366f1", border: "none", borderRadius: 8, padding: "8px 20px", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Réessayer</button>
        </div>
      </div>
    );
  }

  const channels = data?.channels || [];
  const people = data?.people || [];
  const groupDms = data?.groupDms || [];
  const groups = data?.groups || [];

  const total = channels.length;
  const pub = channels.filter(c => !c.isPrivate).length;
  const priv = channels.filter(c => c.isPrivate).length;
  const withDesc = channels.filter(c => c.hasDesc).length;
  const withTopic = channels.filter(c => c.hasTopic).length;
  const compliantAll = channels.filter(c => isCompliant(c) && c.hasDesc).length;
  const dormant = channels.filter(c => c.lastActive > 90);
  const tempDormant = dormant.filter(c => c.name.startsWith("temp"));
  const nonCompliantList = channels.filter(c => !isCompliant(c));
  const avgThread = people.length > 0 ? Math.round(people.reduce((a, m) => a + (m.threadRatio || 0), 0) / people.length) : 0;

  const helpSlackChannel = channels.find(c => c.name === "help-slack");

  const filtered = channels.filter(c => {
    const s = chSearch.toLowerCase();
    const matchSearch = !s || c.name.includes(s);
    if (!matchSearch) return false;
    if (chFilter === "non-compliant") return !isCompliant(c);
    if (chFilter === "dormant") return c.lastActive > 90;
    if (chFilter === "private") return c.isPrivate;
    if (chFilter === "temp") return c.name.startsWith("temp");
    if (chFilter === "no-desc") return !c.hasDesc;
    return true;
  });

  const sortedPeople = [...people].sort((a, b) => b[mbSort] - a[mbSort]);
  const maxMentions = Math.max(...people.map(m => m.mentions3m), 1);
  const maxUg = Math.max(...groups.map(g => g.mentions3m), 1);
  const maxGdm = Math.max(...groupDms.map(g => g.messages3m), 1);

  const TABS = [
    { id: "overview", l: "📊 Overview" },
    { id: "channels", l: `📡 Channels (${total})` },
    { id: "people", l: `👥 People (${people.length})` },
    { id: "groupdms", l: `💬 Group DMs (${groupDms.length})` },
    { id: "usergroups", l: `🏷️ User Groups (${groups.length})` },
    { id: "actions", l: "⚡ Actions" },
  ];

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } } * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>
      <div style={{ background: "#0d0d1a", minHeight: "100vh", color: "#e2e2f0", fontFamily: "Inter,sans-serif", padding: "20px 16px", maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>⚡ Slack Health Dashboard <span style={{ color: "#6366f1" }}>· Vizzia</span></div>
            <div style={{ fontSize: 11, color: "#6b6b8a", marginTop: 4 }}>
              {data?.updatedAt ? `Mis à jour le ${new Date(data.updatedAt).toLocaleString("fr-FR")}` : "Chargement…"} · données réelles Slack API · 3 derniers mois
            </div>
          </div>
          <button onClick={fetchData} disabled={loading} style={{ background: loading ? "#2d2d44" : "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 10, padding: "9px 18px", color: "#fff", fontWeight: 600, fontSize: 12, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            {loading ? <><Spinner /> Synchronisation…</> : "🔄 Run Update"}
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#13131f", borderRadius: 11, padding: 4, flexWrap: "wrap" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? "#6366f1" : "transparent", border: "none", borderRadius: 8, padding: "7px 13px", color: tab === t.id ? "#fff" : "#a0a0bf", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
              {t.l}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10, marginBottom: 20 }}>
              <KpiCard icon="✅" label="Compliance globale" value={`${pct(compliantAll, total)}%`} sub={`${compliantAll}/${total} channels`} color={sc(pct(compliantAll, total))} />
              <KpiCard icon="🔓" label="Public vs Private" value={`${pct(pub, total)}%`} sub={`${pub} pub · ${priv} priv`} color="#22d3ee" />
              <KpiCard icon="📝" label="Avec description" value={`${pct(withDesc, total)}%`} sub={`${withDesc}/${total}`} color="#f472b6" />
              <KpiCard icon="🏷️" label="Avec topic" value={`${pct(withTopic, total)}%`} sub={`${withTopic}/${total}`} color="#fb923c" />
              <KpiCard icon="😴" label="Dormants +90j" value={dormant.length} sub={`dont ${tempDormant.length} temp-`} color={dormant.length > 5 ? "#ef4444" : "#f59e0b"} />
              <KpiCard icon="👥" label="Membres actifs" value={people.length} color="#22c55e" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              <div style={{ background: "#1e1e2e", borderRadius: 14, padding: 18, border: "1px solid #2d2d44" }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14 }}>📊 Compliance Breakdown</div>
                {[
                  { l: "Naming Convention", v: pct(channels.filter(c => c.namingOk).length, total) },
                  { l: "Topic renseigné", v: pct(withTopic, total) },
                  { l: "Description renseignée", v: pct(withDesc, total) },
                  { l: "Channels publics", v: pct(pub, total) },
                  { l: "Conformité complète", v: pct(compliantAll, total) },
                ].map(r => (
                  <div key={r.l} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                      <span style={{ color: "#c0c0df" }}>{r.l}</span>
                      <span style={{ fontWeight: 700, color: sc(r.v) }}>{r.v}%</span>
                    </div>
                    <Bar value={r.v} color={sc(r.v)} />
                  </div>
                ))}
              </div>
              <div style={{ background: "#1e1e2e", borderRadius: 14, padding: 18, border: "1px solid #2d2d44" }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14 }}>🏆 Top mentions (3 mois)</div>
                {[...people].sort((a, b) => b.mentions3m - a.mentions3m).slice(0, 8).map((m, i) => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                    <span style={{ fontSize: 10, color: "#6b6b8a", width: 14 }}>{i + 1}</span>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0, overflow: "hidden" }}>
                      {m.avatar ? <img src={m.avatar} style={{ width: 22, height: 22 }} alt="" /> : m.name[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                      <Bar value={m.mentions3m} max={maxMentions} color="#6366f1" />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa" }}>{m.mentions3m}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: "#1e1e2e", borderRadius: 14, padding: 18, border: "1px solid #2d2d44" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>🚨 Alertes actives</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {nonCompliantList.length > 0 && <div style={{ background: "#450a0a", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#fca5a5" }}>⚠️ <strong>{nonCompliantList.length}</strong> channels non-compliant</div>}
                {tempDormant.length > 0 && <div style={{ background: "#3f1a00", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#fdba74" }}>🗄️ <strong>{tempDormant.length}</strong> channels temp- inactifs depuis +90j</div>}
                {dormant.filter(c => !c.name.startsWith("temp")).length > 0 && <div style={{ background: "#1e2a3a", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#93c5fd" }}>💤 <strong>{dormant.filter(c => !c.name.startsWith("temp")).length}</strong> autres channels dormants</div>}
                {groupDms.filter(g => g.messages3m >= 50).length > 0 && <div style={{ background: "#1a1a3a", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#c4b5fd" }}>💬 <strong>{groupDms.filter(g => g.messages3m >= 50).length}</strong> group DMs très actifs → suggérer un channel</div>}
              </div>
            </div>
          </div>
        )}

        {/* CHANNELS */}
        {tab === "channels" && (
          <div>
            <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
              {[["all", "Tous"], ["non-compliant", "⚠️ Non-compliant"], ["no-desc", "📝 Sans desc"], ["dormant", "😴 Dormants"], ["temp", "🕐 Temp"], ["private", "🔒 Privés"]].map(([f, l]) => (
                <button key={f} onClick={() => setChFilter(f)} style={{ background: chFilter === f ? "#6366f1" : "#1e1e2e", border: "1px solid #2d2d44", borderRadius: 8, padding: "5px 11px", color: chFilter === f ? "#fff" : "#a0a0bf", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{l}</button>
              ))}
              <input value={chSearch} onChange={e => setChSearch(e.target.value)} placeholder="🔍 Rechercher..." style={{ marginLeft: "auto", background: "#1e1e2e", border: "1px solid #2d2d44", borderRadius: 8, padding: "5px 10px", color: "#e2e2f0", fontSize: 11, outline: "none", width: 160 }} />
              <span style={{ fontSize: 11, color: "#6b6b8a" }}>{filtered.length} résultats</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {filtered.map(ch => {
                const open = expandedCh === ch.id;
                return (
                  <div key={ch.id} style={{ background: "#1e1e2e", borderRadius: 10, border: `1px solid ${open ? "#6366f1" : "#2d2d44"}`, overflow: "hidden" }}>
                    <div onClick={() => setExpandedCh(open ? null : ch.id)} style={{ display: "flex", alignItems: "center", padding: "9px 14px", cursor: "pointer", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: ch.isPrivate ? "#f59e0b" : "#a78bfa", fontWeight: 700, fontFamily: "monospace" }}>#{ch.name}</span>
                      <span style={{ fontSize: 10, color: "#6b6b8a" }}>{ch.isPrivate ? "🔒" : "🔓"}</span>
                      <div style={{ display: "flex", gap: 4, marginLeft: "auto", flexWrap: "wrap" }}>
                        <Badge ok={ch.namingOk} label="naming" />
                        <Badge ok={ch.hasTopic} label="topic" />
                        <Badge ok={ch.hasDesc} label="desc" />
                        {ch.lastActive > 90 && <span style={{ fontSize: 10, background: "#450a0a", color: "#fca5a5", borderRadius: 20, padding: "2px 6px", fontWeight: 600 }}>😴 {ch.lastActive}j</span>}
                      </div>
                      <span style={{ fontSize: 10, color: "#6b6b8a" }}>{open ? "▲" : "▼"}</span>
                    </div>
                    {open && (
                      <div style={{ padding: "0 14px 14px", borderTop: "1px solid #2d2d44", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 10 }}>
                        <div><div style={{ fontSize: 10, color: "#6b6b8a" }}>Créé le</div><div style={{ fontSize: 12, fontWeight: 600 }}>{ch.created}</div></div>
                        <div><div style={{ fontSize: 10, color: "#6b6b8a" }}>Dernier msg</div><div style={{ fontSize: 12, fontWeight: 600, color: ch.lastActive > 90 ? "#ef4444" : ch.lastActive > 30 ? "#f59e0b" : "#22c55e" }}>{ch.lastActive === 0 ? "Aujourd'hui" : `il y a ${ch.lastActive}j`}</div></div>
                        <div><div style={{ fontSize: 10, color: "#6b6b8a" }}>Messages (3 mois)</div><div style={{ fontSize: 12, fontWeight: 600 }}>{ch.msgCount}</div></div>
                        <div><div style={{ fontSize: 10, color: "#6b6b8a" }}>Thread rate</div><div style={{ fontSize: 12, fontWeight: 600, color: sc(ch.threadRatio) }}>{ch.threadRatio}%</div></div>
                        <div><div style={{ fontSize: 10, color: "#6b6b8a" }}>Visibilité</div><div style={{ fontSize: 12, fontWeight: 600 }}>{ch.isPrivate ? "Privé 🔒" : "Public 🔓"}</div></div>
                        {ch.topicValue && <div style={{ gridColumn: "span 3" }}><div style={{ fontSize: 10, color: "#6b6b8a" }}>Topic</div><div style={{ fontSize: 11, color: "#c0c0df", fontStyle: "italic" }}>{ch.topicValue}</div></div>}
                        {ch.descValue && <div style={{ gridColumn: "span 3" }}><div style={{ fontSize: 10, color: "#6b6b8a" }}>Description</div><div style={{ fontSize: 11, color: "#c0c0df", fontStyle: "italic" }}>{ch.descValue}</div></div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PEOPLE */}
        {tab === "people" && (
          <div>
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {[["mentions3m", "🏷️ Mentions"], ["msgSent", "📢 Messages"], ["reactionsGiven", "😍 Réactions données"], ["reactionsReceived", "🎯 Réactions reçues"], ["pubPct", "🔓 Pub ratio"]].map(([k, l]) => (
                <button key={k} onClick={() => setMbSort(k)} style={{ background: mbSort === k ? "#6366f1" : "#1e1e2e", border: "1px solid #2d2d44", borderRadius: 8, padding: "5px 10px", color: mbSort === k ? "#fff" : "#a0a0bf", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{l}</button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {sortedPeople.map(m => {
                const open = expandedMb === m.id;
                return (
                  <div key={m.id} style={{ background: "#1e1e2e", borderRadius: 11, border: `1px solid ${open ? "#6366f1" : "#2d2d44"}`, overflow: "hidden" }}>
                    <div onClick={() => setExpandedMb(open ? null : m.id)} style={{ display: "flex", alignItems: "center", padding: "10px 14px", cursor: "pointer", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0, overflow: "hidden" }}>
                        {m.avatar ? <img src={m.avatar} style={{ width: 30, height: 30 }} alt="" /> : m.name[0]}
                      </div>
                      <div style={{ flex: 1, minWidth: 100 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{m.name}</div>
                        <div style={{ fontSize: 10, color: "#6b6b8a" }}>{m.title || "—"}</div>
                      </div>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                        <div style={{ textAlign: "center" }}><div style={{ fontSize: 14, fontWeight: 700, color: "#a78bfa" }}>{m.mentions3m}</div><div style={{ fontSize: 9, color: "#6b6b8a" }}>mentions</div></div>
                        <div style={{ textAlign: "center" }}><div style={{ fontSize: 14, fontWeight: 700, color: "#22d3ee" }}>{m.msgSent}</div><div style={{ fontSize: 9, color: "#6b6b8a" }}>messages</div></div>
                        <div style={{ textAlign: "center" }}><div style={{ fontSize: 14, fontWeight: 700, color: sc(m.pubPct) }}>{m.pubPct}%</div><div style={{ fontSize: 9, color: "#6b6b8a" }}>pub ratio</div></div>
                        <div style={{ textAlign: "center" }}><div style={{ fontSize: 14, fontWeight: 700, color: "#f59e0b" }}>{m.reactionsGiven}</div><div style={{ fontSize: 9, color: "#6b6b8a" }}>réactions</div></div>
                      </div>
                      <span style={{ fontSize: 10, color: "#6b6b8a" }}>{open ? "▲" : "▼"}</span>
                    </div>
                    {open && (
                      <div style={{ padding: "0 14px 14px", borderTop: "1px solid #2d2d44", marginTop: 4 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
                          <div>
                            <div style={{ fontSize: 10, color: "#6b6b8a", marginBottom: 5 }}>Messages publics vs privés</div>
                            <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 4 }}>
                              <div style={{ flex: m.pubPct, background: "#6366f1" }} />
                              <div style={{ flex: 100 - m.pubPct, background: "#f59e0b" }} />
                            </div>
                            <div style={{ display: "flex", gap: 10, fontSize: 10 }}>
                              <span style={{ color: "#a78bfa" }}>🔓 {m.publicMsgs} ({m.pubPct}%)</span>
                              <span style={{ color: "#f59e0b" }}>🔒 {m.privateMsgs} ({100 - m.pubPct}%)</span>
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: "#6b6b8a", marginBottom: 5 }}>Réactions</div>
                            <div style={{ fontSize: 13 }}><span style={{ color: "#f59e0b", fontWeight: 700 }}>{m.reactionsGiven}</span> données · <span style={{ color: "#22d3ee", fontWeight: 700 }}>{m.reactionsReceived}</span> reçues</div>
                          </div>
                        </div>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 3 }}>
                            <span style={{ color: "#a0a0bf" }}>Mentions reçues (3 mois)</span>
                            <span style={{ fontWeight: 700, color: "#a78bfa" }}>{m.mentions3m}</span>
                          </div>
                          <Bar value={m.mentions3m} max={maxMentions} color="#a78bfa" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* GROUP DMS */}
        {tab === "groupdms" && (
          <div>
            <div style={{ background: "#1a1a3a", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#c4b5fd", border: "1px solid #4c1d95" }}>
              💬 <strong>{groupDms.length} Group DMs</strong> détectés · nombre de <strong>messages postés</strong> sur les 3 derniers mois
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...groupDms].sort((a, b) => b.messages3m - a.messages3m).map(g => {
                const open = expandedGdm === g.id;
                const hot = g.messages3m >= 50;
                return (
                  <div key={g.id} style={{ background: "#1e1e2e", borderRadius: 11, border: `1px solid ${hot ? "#7c3aed" : "#2d2d44"}`, overflow: "hidden" }}>
                    <div onClick={() => setExpandedGdm(open ? null : g.id)} style={{ display: "flex", alignItems: "center", padding: "10px 14px", cursor: "pointer", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#5b21b6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>💬</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>{g.members.join(", ") || g.name}</div>
                        <div style={{ fontSize: 10, color: "#6b6b8a" }}>{g.members.length} membres</div>
                        <Bar value={g.messages3m} max={maxGdm} color="#7c3aed" />
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: hot ? "#ef4444" : "#c4b5fd" }}>{g.messages3m}</div>
                        <div style={{ fontSize: 9, color: "#6b6b8a" }}>messages (3 mois)</div>
                      </div>
                      {hot && <span style={{ fontSize: 10, background: "#450a0a", color: "#fca5a5", borderRadius: 20, padding: "2px 7px", fontWeight: 600 }}>🔥 Très actif</span>}
                      <span style={{ fontSize: 10, color: "#6b6b8a" }}>{open ? "▲" : "▼"}</span>
                    </div>
                    {open && (
                      <div style={{ padding: "0 14px 14px", borderTop: "1px solid #2d2d44", marginTop: 4 }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                          {g.members.map(mb => <span key={mb} style={{ background: "#2d2d44", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "#c4b5fd" }}>{mb}</span>)}
                        </div>
                        {hot && helpSlackChannel && (
                          <button onClick={() => doNotify(helpSlackChannel.id, `💬 Le group DM entre *${g.members.join(", ")}* est très actif (${g.messages3m} messages en 3 mois). Envisagez de créer un channel dédié pour plus de visibilité !`, g.name)} style={{ background: "linear-gradient(135deg,#5b21b6,#7c3aed)", border: "none", borderRadius: 8, padding: "7px 14px", color: "#fff", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>
                            📢 Suggérer un channel sur #help-slack
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* USER GROUPS */}
        {tab === "usergroups" && (
          <div>
            {groups.length === 0 ? (
              <div style={{ background: "#1e1e2e", borderRadius: 14, padding: 32, border: "1px solid #2d2d44", textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🏷️</div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Aucun User Group trouvé</div>
                <div style={{ fontSize: 12, color: "#6b6b8a", maxWidth: 360, margin: "0 auto" }}>
                  Crée des User Groups dans <strong>Slack Admin → People → User Groups</strong>, puis clique "Run Update" pour les voir apparaître ici avec leurs statistiques de mentions.
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[...groups].sort((a, b) => b.mentions3m - a.mentions3m).map(g => {
                  const open = expandedUg === g.id;
                  return (
                    <div key={g.id} style={{ background: "#1e1e2e", borderRadius: 11, border: `1px solid ${open ? "#6366f1" : "#2d2d44"}`, overflow: "hidden" }}>
                      <div onClick={() => setExpandedUg(open ? null : g.id)} style={{ display: "flex", alignItems: "center", padding: "10px 14px", cursor: "pointer", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#0891b2,#0e7490)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>👥</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{g.handle} <span style={{ fontSize: 11, color: "#6b6b8a", fontWeight: 400 }}>· {g.name}</span></div>
                          <div style={{ fontSize: 10, color: "#6b6b8a" }}>{g.memberCount} membres</div>
                          <Bar value={g.mentions3m} max={maxUg} color="#0891b2" />
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: "#22d3ee" }}>{g.mentions3m}</div>
                          <div style={{ fontSize: 9, color: "#6b6b8a" }}>mentions (3 mois)</div>
                        </div>
                        <span style={{ fontSize: 10, color: "#6b6b8a" }}>{open ? "▲" : "▼"}</span>
                      </div>
                      {open && (
                        <div style={{ padding: "0 14px 14px", borderTop: "1px solid #2d2d44", marginTop: 4 }}>
                          {g.description && <div style={{ fontSize: 11, color: "#a0a0bf", fontStyle: "italic", marginBottom: 10 }}>{g.description}</div>}
                          <div style={{ fontSize: 11, color: "#6b6b8a", marginBottom: 8 }}>Membres :</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {g.memberNames.map(mb => (
                              <div key={mb} style={{ background: "#13131f", border: "1px solid #2d2d44", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "#e2e2f0", display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ width: 16, height: 16, borderRadius: "50%", background: "linear-gradient(135deg,#0891b2,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700 }}>{mb[0]}</div>
                                {mb}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ACTIONS */}
        {tab === "actions" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Non-compliant */}
            <div style={{ background: "#1e1e2e", borderRadius: 14, padding: 18, border: "1px solid #2d2d44" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>⚠️ Notifier les owners — channels non-compliant</div>
              <div style={{ fontSize: 11, color: "#6b6b8a", marginBottom: 12 }}>{nonCompliantList.length} channels. Message posté sur <strong style={{ color: "#a78bfa" }}>#help-slack</strong>.</div>
              <div style={{ maxHeight: 180, overflowY: "auto", marginBottom: 12 }}>
                {nonCompliantList.map(c => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, padding: "4px 0", borderBottom: "1px solid #2d2d44", gap: 4, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 10, color: "#e2e2f0" }}>#{c.name}</span>
                    <div style={{ display: "flex", gap: 3 }}>
                      {!c.namingOk && <Badge ok={false} label="naming" />}
                      {!c.hasTopic && <Badge ok={false} label="topic" />}
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  if (!helpSlackChannel) { addLog("❌ Channel #help-slack introuvable"); return; }
                  const list = nonCompliantList.map(c => `• #${c.name} (${!c.namingOk ? "naming" : ""}${!c.namingOk && !c.hasTopic ? " + " : ""}${!c.hasTopic ? "topic manquant" : ""})`).join("\n");
                  doNotify(helpSlackChannel.id, `⚠️ *Channels non-compliant détectés* — merci de corriger :\n${list}\n\n📖 Guide naming : https://www.notion.so/vizzia/Slack-Channels-Naming-2e745c4b899e80038d67d93760f29717`, "notification non-compliant");
                }}
                style={{ background: "linear-gradient(135deg,#dc2626,#b91c1c)", border: "none", borderRadius: 9, padding: "8px 16px", color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                📩 Poster sur #help-slack
              </button>
            </div>

            {/* Temp dormant */}
            <div style={{ background: "#1e1e2e", borderRadius: 14, padding: 18, border: "1px solid #2d2d44" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>🗄️ Archiver les channels <code style={{ color: "#a78bfa" }}>temp-</code> inactifs</div>
              <div style={{ fontSize: 11, color: "#6b6b8a", marginBottom: 12 }}>{tempDormant.length} channels sans message depuis +90j.</div>
              <div style={{ maxHeight: 140, overflowY: "auto", marginBottom: 12 }}>
                {tempDormant.map(c => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, padding: "4px 0", borderBottom: "1px solid #2d2d44" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 10 }}>#{c.name}</span>
                    <span style={{ color: "#ef4444" }}>{c.lastActive}j</span>
                    <button onClick={() => doArchive(c.id, c.name)} style={{ background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 6, padding: "2px 8px", color: "#fca5a5", fontSize: 10, cursor: "pointer" }}>Archiver</button>
                  </div>
                ))}
              </div>
              <button onClick={() => tempDormant.forEach(c => doArchive(c.id, c.name))} style={{ background: "linear-gradient(135deg,#92400e,#78350f)", border: "none", borderRadius: 9, padding: "8px 16px", color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                🗄️ Tout archiver ({tempDormant.length})
              </button>
            </div>

            {/* Dormant notify */}
            <div style={{ background: "#1e1e2e", borderRadius: 14, padding: 18, border: "1px solid #2d2d44" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>💤 Alerter les owners — channels dormants</div>
              <div style={{ fontSize: 11, color: "#6b6b8a", marginBottom: 12 }}>{dormant.filter(c => !c.name.startsWith("temp")).length} channels inactifs (hors temp-).</div>
              <div style={{ maxHeight: 140, overflowY: "auto", marginBottom: 12 }}>
                {dormant.filter(c => !c.name.startsWith("temp")).map(c => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "4px 0", borderBottom: "1px solid #2d2d44" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 10 }}>#{c.name}</span>
                    <span style={{ color: "#93c5fd" }}>{c.lastActive}j</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  if (!helpSlackChannel) { addLog("❌ #help-slack introuvable"); return; }
                  const list = dormant.filter(c => !c.name.startsWith("temp")).map(c => `• #${c.name} (inactif depuis ${c.lastActive}j)`).join("\n");
                  doNotify(helpSlackChannel.id, `💤 *Channels inactifs depuis +90 jours* — les owners sont invités à confirmer l'archivage :\n${list}`, "alerte dormants");
                }}
                style={{ background: "linear-gradient(135deg,#1e40af,#1d4ed8)", border: "none", borderRadius: 9, padding: "8px 16px", color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                ⚠️ Envoyer alertes archivage
              </button>
            </div>

            {/* Log */}
            <div style={{ background: "#1e1e2e", borderRadius: 14, padding: 18, border: "1px solid #2d2d44" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>📋 Journal d'activité</div>
              {actionLog.length === 0
                ? <div style={{ fontSize: 11, color: "#6b6b8a" }}>Aucune action effectuée.</div>
                : <div style={{ background: "#0f0f1a", borderRadius: 8, padding: "10px 14px", maxHeight: 150, overflowY: "auto" }}>
                  {actionLog.map((m, i) => <div key={i} style={{ fontSize: 11, color: "#a0a0bf", padding: "2px 0", borderBottom: i < actionLog.length - 1 ? "1px solid #2d2d44" : "none" }}>{m}</div>)}
                </div>
              }
            </div>
          </div>
        )}
      </div>
    </>
  );
}
