import { useState, useEffect, useCallback } from "react";

function isCompliant(ch) { return ch.namingOk && ch.hasTopic; }
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
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 20,
      background: ok ? "#14532d" : "#450a0a", color: ok ? "#4ade80" : "#f87171",
      border: `1px solid ${ok ? "#166534" : "#7f1d1d"}` }}>
      {label}
    </span>
  );
}

function Bar({ value, max = 100, color = "#6366f1" }) {
  return (
    <div style={{ background: "#2d2d44", borderRadius: 99, height: 5, width: "100%" }}>
      <div style={{ background: color, borderRadius: 99, height: 5, width: `${Math.min(100, max > 0 ? (value / max) * 100 : 0)}%`, transition: "width .5s" }} />
    </div>
  );
}

function Spinner() {
  return <div style={{ display: "inline-block", width: 16, height: 16, border: "2px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />;
}

function KpiCell({ value, label, color, active }) {
  return (
    <div style={{ textAlign: "center", minWidth: 80, padding: "4px 8px", borderRadius: 8, background: active ? "#2d2d44" : "transparent" }}>
      <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 9, color: "#6b6b8a", marginTop: 1 }}>{label}</div>
    </div>
  );
}

const PEOPLE_SORT = [
  { key: "mentions3m",        label: "# Mentions",          color: "#a78bfa" },
  { key: "msgSent",           label: "# Messages envoyés",  color: "#22d3ee" },
  { key: "threadPct",         label: "% Thread (publics)",  color: "#f472b6" },
  { key: "pubPct",            label: "% Public vs Private", color: "#22c55e" },
  { key: "reactionsGiven",    label: "Réactions envoyées",  color: "#f59e0b" },
  { key: "reactionsReceived", label: "Réactions reçues",    color: "#fb923c" },
];

function SortBtn({ label, sortKey, current, dir, onClick }) {
  const active = current === sortKey;
  return (
    <span onClick={() => onClick(sortKey)} style={{ cursor: "pointer", fontSize: 10, color: active ? "#a78bfa" : "#6b6b8a", fontWeight: active ? 700 : 400, userSelect: "none" }}>
      {label} {active ? (dir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );
}

const ACTION_TABS = [
  { id: "noncompliant", l: "⚠️ Non-compliant" },
  { id: "dormant",      l: "💤 Dormants" },
  { id: "temp",         l: "🕐 Temp" },
  { id: "thread",       l: "🧵 % Thread" },
  { id: "pubpriv",      l: "🔒 % Public/Privé" },
];

export default function App() {
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLog, setActionLog] = useState([]);
  const [actionTab, setActionTab] = useState("noncompliant");

  const [chTab, setChTab] = useState("all");
  const [chSort, setChSort] = useState("lastActive");
  const [chDir, setChDir] = useState("desc");
  const [mbSort, setMbSort] = useState("mentions3m");
  const [expandedGdm, setExpandedGdm] = useState(null);
  const [expandedUg, setExpandedUg] = useState(null);

  const addLog = (m) => setActionLog(p => [`[${new Date().toLocaleTimeString()}] ${m}`, ...p].slice(0, 30));

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/slack");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setData(json);
      addLog(`✅ Données mises à jour — ${json.channels?.length} channels, ${json.people?.length} membres`);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const doArchive = async (channelId, channelName) => {
    try {
      const res = await fetch(`/api/slack?action=archive&channelId=${channelId}`);
      const json = await res.json();
      addLog(json.ok ? `🗄️ #${channelName} archivé` : `❌ Erreur archivage #${channelName}`);
    } catch { addLog(`❌ Erreur archivage #${channelName}`); }
  };

  const doNotify = async (channelId, message, label) => {
    try {
      const res = await fetch(`/api/slack?action=notify&channelId=${channelId}&message=${encodeURIComponent(message)}`);
      const json = await res.json();
      addLog(json.ok ? `📩 Message envoyé : ${label}` : `❌ Erreur envoi message`);
    } catch { addLog(`❌ Erreur envoi message`); }
  };

  if (loading && !data) return (
    <div style={{ background: "#0d0d1a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#e2e2f0", fontFamily: "Inter,sans-serif" }}>
      <div style={{ textAlign: "center" }}><Spinner /><div style={{ marginTop: 16, fontSize: 14, color: "#a0a0bf" }}>Connexion à Slack…</div><div style={{ marginTop: 6, fontSize: 11, color: "#6b6b8a" }}>Récupération des channels, membres et stats (90 jours)</div></div>
    </div>
  );

  if (error) return (
    <div style={{ background: "#0d0d1a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#e2e2f0", fontFamily: "Inter,sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>❌</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Erreur de connexion Slack</div>
        <div style={{ fontSize: 12, color: "#f87171", background: "#450a0a", padding: "8px 16px", borderRadius: 8, marginBottom: 16 }}>{error}</div>
        <div style={{ fontSize: 12, color: "#6b6b8a", marginBottom: 16 }}>Vérifiez que <code>SLACK_BOT_TOKEN</code> est configuré dans Vercel.</div>
        <button onClick={fetchData} style={{ background: "#6366f1", border: "none", borderRadius: 8, padding: "8px 20px", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Réessayer</button>
      </div>
    </div>
  );

  const channels = (data?.channels || []).filter(c => !c.isPrivate);
  const allChannelsRaw = data?.channels || [];
  const people = data?.people || [];
  const groupDms = data?.groupDms || [];
  const groups = data?.groups || [];

  const total = channels.length;
  const withDesc = channels.filter(c => c.hasDesc).length;
  const withTopic = channels.filter(c => c.hasTopic).length;
  const compliantAll = channels.filter(c => isCompliant(c) && c.hasDesc).length;
  const dormantChs = channels.filter(c => c.lastActive > 90);
  const tempDormant = dormantChs.filter(c => c.name.startsWith("temp"));
  const nonCompliantList = channels.filter(c => !isCompliant(c));
  const helpSlackChannel = allChannelsRaw.find(c => c.name === "help-slack");
  const generalChannel = allChannelsRaw.find(c => c.name === "general");
  const maxMentions = Math.max(...people.map(m => m.mentions3m), 1);
  const maxGdm = Math.max(...groupDms.map(g => g.messages3m), 1);
  const maxUg = Math.max(...groups.map(g => g.mentions3m), 1);

  const peopleById = Object.fromEntries(people.map(p => [p.id, p]));

  const sortChannels = (list, key, dir) => {
    return [...list].sort((a, b) => {
      let av = a[key] ?? 0, bv = b[key] ?? 0;
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
  };

  const toggleSort = (key) => {
    if (chSort === key) setChDir(d => d === "asc" ? "desc" : "asc");
    else { setChSort(key); setChDir("desc"); }
  };

  const pubChannels = channels;
  const nonCompliant = channels.filter(c => !isCompliant(c));
  const dormant = channels.filter(c => c.lastActive > 90 && !c.name.startsWith("temp"));
  const temp = channels.filter(c => c.name.startsWith("temp") && c.lastActive > 90);
  const compliant = channels.filter(c => c.fullyCompliant || (isCompliant(c) && c.hasDesc));

  const getOwnerName = (ownerId) => {
    const p = peopleById[ownerId];
    return p ? (p.name || p.displayName) : (ownerId || "—");
  };

  const ncByOwner = {};
  nonCompliant.forEach(c => {
    const o = c.owner || "unknown";
    if (!ncByOwner[o]) ncByOwner[o] = [];
    ncByOwner[o].push(c);
  });

  // People with low thread %
  const lowThread = [...people].filter(m => m.msgSent > 0 && (m.threadPct ?? 0) < 80).sort((a, b) => (a.threadPct ?? 0) - (b.threadPct ?? 0));
  // People with low public %
  const lowPub = [...people].filter(m => m.msgSent > 0 && (m.pubPct ?? 0) < 80).sort((a, b) => (a.pubPct ?? 0) - (b.pubPct ?? 0));

  const CH_COLS = [
    { key: "name",        label: "Channel" },
    { key: "owner",       label: "Owner" },
    { key: "created",     label: "Créé le" },
    { key: "threadRatio", label: "Thread rate" },
    { key: "msgCount",    label: "Messages (200 derniers)" },
    { key: "lastActive",  label: "Dormant (j)" },
  ];

  function ChannelTable({ list, showCompliance = true }) {
    const sorted = sortChannels(list, chSort, chDir);
    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #2d2d44" }}>
              {CH_COLS.map(col => (
                <th key={col.key} style={{ padding: "6px 10px", textAlign: "left", color: "#6b6b8a", fontWeight: 600, whiteSpace: "nowrap" }}>
                  <SortBtn label={col.label} sortKey={col.key} current={chSort} dir={chDir} onClick={toggleSort} />
                </th>
              ))}
              {showCompliance && <th style={{ padding: "6px 10px", color: "#6b6b8a", fontWeight: 600 }}>Compliance</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map(ch => (
              <tr key={ch.id} style={{ borderBottom: "1px solid #1a1a2e" }}>
                <td style={{ padding: "7px 10px", fontFamily: "monospace", color: "#a78bfa", fontWeight: 700 }}>#{ch.name}</td>
                <td style={{ padding: "7px 10px", color: "#c0c0df" }}>{getOwnerName(ch.owner)}</td>
                <td style={{ padding: "7px 10px", color: "#a0a0bf" }}>{ch.created}</td>
                <td style={{ padding: "7px 10px", color: sc(ch.threadRatio), fontWeight: 700 }}>{ch.threadRatio}%</td>
                <td style={{ padding: "7px 10px", color: "#e2e2f0" }}>{ch.msgCount}</td>
                <td style={{ padding: "7px 10px", color: ch.lastActive > 90 ? "#ef4444" : ch.lastActive > 30 ? "#f59e0b" : "#22c55e", fontWeight: ch.lastActive > 90 ? 700 : 400 }}>
                  {ch.lastActive === 999 ? "—" : ch.lastActive === 0 ? "Aujourd'hui" : `${ch.lastActive}j`}
                </td>
                {showCompliance && (
                  <td style={{ padding: "7px 10px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <Badge ok={ch.namingOk} label="naming" />
                      <Badge ok={ch.hasTopic} label="topic" />
                      <Badge ok={ch.hasDesc} label="desc" />
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && <div style={{ textAlign: "center", padding: 32, color: "#6b6b8a", fontSize: 12 }}>Aucun channel dans cette catégorie ✅</div>}
      </div>
    );
  }

  const TABS = [
    { id: "overview",   l: "📊 Overview" },
    { id: "channels",   l: `📡 Channels (${total})` },
    { id: "people",     l: `👥 People (${people.length})` },
    { id: "groupdms",   l: `💬 Group DMs (${groupDms.length})` },
    { id: "usergroups", l: `🏷️ User Groups (${groups.length})` },
    { id: "actions",      l: "⚡ Actions" },
    { id: "bestpractices", l: "📚 Best Practices" },
  ];

  const CH_TABS = [
    { id: "all",          l: `Tous (${pubChannels.length})` },
    { id: "compliant",    l: `✅ Compliant (${compliant.length})` },
    { id: "noncompliant", l: `⚠️ Non-compliant (${nonCompliant.length})` },
    { id: "dormant",      l: `😴 Dormants (${dormant.length})` },
    { id: "temp",         l: `🕐 Temp (${temp.length})` },
  ];

  // ── Action sub-tab renderers ──

  function ActionNonCompliant() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 11, color: "#6b6b8a" }}>Un message personnalisé par owner, posté sur <strong style={{ color: "#a78bfa" }}>#help-slack</strong>.</div>
        <button onClick={() => {
          if (!helpSlackChannel) { addLog("❌ #help-slack introuvable"); return; }
          Object.entries(ncByOwner).forEach(([ownerId, chs]) => {
            const ownerName = getOwnerName(ownerId);
            const list = chs.map(c => `• #${c.name} — ${[!c.namingOk && "naming ❌", !c.hasTopic && "topic manquant ❌", !c.hasDesc && "description manquante ❌"].filter(Boolean).join(", ")}`).join("\n");
            doNotify(helpSlackChannel.id,
              `⚠️ *Action requise — channels non-compliant*\n\nBonjour *${ownerName}*, vous êtes owner des channels suivants qui ne respectent pas les conventions Slack :\n\n${list}\n\n📖 Guide naming : https://www.notion.so/vizzia/Slack-Channels-Naming-2e745c4b899e80038d67d93760f29717\n\nMerci de corriger dès que possible 🙏`,
              `notification owner ${ownerName}`
            );
          });
        }} style={{ background: "linear-gradient(135deg,#dc2626,#b91c1c)", border: "none", borderRadius: 9, padding: "8px 18px", color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer", alignSelf: "flex-start" }}>
          📩 Envoyer à tous les owners ({Object.keys(ncByOwner).length})
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Object.entries(ncByOwner).map(([ownerId, chs]) => {
            const ownerName = getOwnerName(ownerId);
            return (
              <div key={ownerId} style={{ background: "#13131f", borderRadius: 10, padding: "12px 14px", border: "1px solid #2d2d44" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>👤 {ownerName}</div>
                  <button onClick={() => {
                    if (!helpSlackChannel) { addLog("❌ #help-slack introuvable"); return; }
                    const list = chs.map(c => `• #${c.name} — ${[!c.namingOk && "naming ❌", !c.hasTopic && "topic manquant ❌", !c.hasDesc && "description manquante ❌"].filter(Boolean).join(", ")}`).join("\n");
                    doNotify(helpSlackChannel.id,
                      `⚠️ *Action requise — channels non-compliant*\n\nBonjour *${ownerName}*, vous êtes owner des channels suivants qui ne respectent pas les conventions Slack :\n\n${list}\n\n📖 Guide naming : https://www.notion.so/vizzia/Slack-Channels-Naming-2e745c4b899e80038d67d93760f29717\n\nMerci de corriger dès que possible 🙏`,
                      `notification owner ${ownerName}`
                    );
                  }} style={{ background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 7, padding: "4px 12px", color: "#fca5a5", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    📩 Notifier
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {chs.map(c => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "monospace", fontSize: 11, color: "#a78bfa" }}>#{c.name}</span>
                      <div style={{ display: "flex", gap: 3 }}>
                        {!c.namingOk && <Badge ok={false} label="naming" />}
                        {!c.hasTopic && <Badge ok={false} label="topic" />}
                        {!c.hasDesc && <Badge ok={false} label="desc" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function ActionDormant() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 11, color: "#6b6b8a" }}>{dormant.length} channels inactifs depuis +90j (hors temp-). Le message sera posté dans <strong style={{ color: "#a78bfa" }}>#general</strong>.</div>
        <div style={{ background: "#13131f", borderRadius: 10, border: "1px solid #2d2d44", overflow: "hidden" }}>
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {dormant.map(c => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, padding: "7px 14px", borderBottom: "1px solid #2d2d44" }}>
                <span style={{ fontFamily: "monospace", color: "#a78bfa" }}>#{c.name}</span>
                <span style={{ color: "#93c5fd" }}>{c.lastActive}j</span>
              </div>
            ))}
          </div>
        </div>
        <button onClick={() => {
          if (!generalChannel) { addLog("❌ #general introuvable"); return; }
          const list = dormant.map(c => `• #${c.name} (inactif depuis ${c.lastActive}j)`).join("\n");
          doNotify(generalChannel.id, `💤 *Channels inactifs depuis +90 jours* — les owners sont invités à confirmer l'archivage :\n${list}`, "alerte dormants");
        }} style={{ background: "linear-gradient(135deg,#1e40af,#1d4ed8)", border: "none", borderRadius: 9, padding: "8px 16px", color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer", alignSelf: "flex-start" }}>
          ⚠️ Envoyer alertes archivage sur #general
        </button>
      </div>
    );
  }

  function ActionTemp() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 11, color: "#6b6b8a" }}>{tempDormant.length} channels <code style={{ color: "#a78bfa" }}>temp-</code> sans message depuis +90j.</div>
        <div style={{ background: "#13131f", borderRadius: 10, border: "1px solid #2d2d44", overflow: "hidden" }}>
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {tempDormant.map(c => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, padding: "7px 14px", borderBottom: "1px solid #2d2d44" }}>
                <span style={{ fontFamily: "monospace", color: "#a78bfa" }}>#{c.name}</span>
                <span style={{ color: "#ef4444" }}>{c.lastActive}j</span>
                <button onClick={() => doArchive(c.id, c.name)} style={{ background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 6, padding: "2px 8px", color: "#fca5a5", fontSize: 10, cursor: "pointer" }}>Archiver</button>
              </div>
            ))}
          </div>
        </div>
        <button onClick={() => tempDormant.forEach(c => doArchive(c.id, c.name))} style={{ background: "linear-gradient(135deg,#92400e,#78350f)", border: "none", borderRadius: 9, padding: "8px 16px", color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer", alignSelf: "flex-start" }}>
          🗄️ Tout archiver ({tempDormant.length})
        </button>
      </div>
    );
  }

  function ActionThread() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 11, color: "#6b6b8a" }}>
          <strong style={{ color: "#f472b6" }}>{lowThread.length} membres</strong> ont moins de 80% de leurs messages publics en thread. Un message d'encouragement sera posté sur <strong style={{ color: "#a78bfa" }}>#help-slack</strong>.
        </div>
        <button onClick={() => {
          if (!helpSlackChannel) { addLog("❌ #help-slack introuvable"); return; }
          const list = lowThread.map(m => `• ${m.name} — ${m.threadPct ?? 0}% de thread`).join("\n");
          doNotify(helpSlackChannel.id,
            `🧵 *Rappel — utilisation des threads*\n\nLes membres suivants ont un faible taux de réponse en thread sur les channels publics :\n\n${list}\n\n💡 Pensez à utiliser les threads pour garder les channels lisibles. Merci ! 🙏`,
            "alerte thread"
          );
        }} style={{ background: "linear-gradient(135deg,#be185d,#9d174d)", border: "none", borderRadius: 9, padding: "8px 18px", color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer", alignSelf: "flex-start" }}>
          📩 Envoyer rappel thread ({lowThread.length} membres)
        </button>
        <div style={{ background: "#13131f", borderRadius: 10, border: "1px solid #2d2d44", overflow: "hidden" }}>
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {lowThread.map(m => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderBottom: "1px solid #2d2d44" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
                  {m.avatar ? <img src={m.avatar} style={{ width: 28, height: 28 }} alt="" /> : m.name[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>{m.name}</div>
                  {m.title && <div style={{ fontSize: 10, color: "#6b6b8a" }}>{m.title}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: sc(m.threadPct ?? 0) }}>{m.threadPct ?? 0}%</div>
                  <div style={{ fontSize: 9, color: "#6b6b8a" }}>thread pub</div>
                </div>
                <button onClick={() => {
                  if (!helpSlackChannel) { addLog("❌ #help-slack introuvable"); return; }
                  doNotify(helpSlackChannel.id,
                    `🧵 *Rappel thread pour ${m.name}*\n\nBonjour *${m.name}*, votre taux d'utilisation des threads sur les channels publics est de *${m.threadPct ?? 0}%*.\n\n💡 Pensez à répondre en thread pour garder les channels lisibles. Merci 🙏`,
                    `rappel thread ${m.name}`
                  );
                }} style={{ background: "#1a0a2e", border: "1px solid #4c1d95", borderRadius: 7, padding: "4px 10px", color: "#c4b5fd", fontSize: 10, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                  📩 Notifier
                </button>
              </div>
            ))}
            {lowThread.length === 0 && <div style={{ textAlign: "center", padding: 32, color: "#6b6b8a", fontSize: 12 }}>Tous les membres sont au-dessus de 80% ✅</div>}
          </div>
        </div>
      </div>
    );
  }

  function ActionPubPriv() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 11, color: "#6b6b8a" }}>
          <strong style={{ color: "#22c55e" }}>{lowPub.length} membres</strong> ont moins de 80% de leurs messages dans des channels publics. Un rappel sera posté sur <strong style={{ color: "#a78bfa" }}>#help-slack</strong>.
        </div>
        <button onClick={() => {
          if (!helpSlackChannel) { addLog("❌ #help-slack introuvable"); return; }
          const list = lowPub.map(m => `• ${m.name} — ${m.pubPct ?? 0}% public`).join("\n");
          doNotify(helpSlackChannel.id,
            `🔒 *Rappel — transparence des échanges*\n\nLes membres suivants ont une majorité de messages dans des channels privés :\n\n${list}\n\n💡 Favorisez les channels publics pour améliorer la visibilité et la collaboration. Merci ! 🙏`,
            "alerte public/privé"
          );
        }} style={{ background: "linear-gradient(135deg,#065f46,#047857)", border: "none", borderRadius: 9, padding: "8px 18px", color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer", alignSelf: "flex-start" }}>
          📩 Envoyer rappel transparence ({lowPub.length} membres)
        </button>
        <div style={{ background: "#13131f", borderRadius: 10, border: "1px solid #2d2d44", overflow: "hidden" }}>
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {lowPub.map(m => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderBottom: "1px solid #2d2d44" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
                  {m.avatar ? <img src={m.avatar} style={{ width: 28, height: 28 }} alt="" /> : m.name[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>{m.name}</div>
                  {m.title && <div style={{ fontSize: 10, color: "#6b6b8a" }}>{m.title}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: sc(m.pubPct ?? 0) }}>{m.pubPct ?? 0}%</div>
                  <div style={{ fontSize: 9, color: "#6b6b8a" }}>public</div>
                </div>
                <button onClick={() => {
                  if (!helpSlackChannel) { addLog("❌ #help-slack introuvable"); return; }
                  doNotify(helpSlackChannel.id,
                    `🔒 *Rappel transparence pour ${m.name}*\n\nBonjour *${m.name}*, seulement *${m.pubPct ?? 0}%* de vos messages sont postés dans des channels publics.\n\n💡 Favorisez les channels publics pour améliorer la visibilité et la collaboration. Merci 🙏`,
                    `rappel pub/priv ${m.name}`
                  );
                }} style={{ background: "#052e16", border: "1px solid #166534", borderRadius: 7, padding: "4px 10px", color: "#4ade80", fontSize: 10, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                  📩 Notifier
                </button>
              </div>
            ))}
            {lowPub.length === 0 && <div style={{ textAlign: "center", padding: 32, color: "#6b6b8a", fontSize: 12 }}>Tous les membres sont au-dessus de 80% ✅</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } } * { box-sizing: border-box; margin: 0; padding: 0; } tr:hover td { background: #1a1a2e; }`}</style>
      <div style={{ background: "#0d0d1a", minHeight: "100vh", color: "#e2e2f0", fontFamily: "Inter,sans-serif", padding: "20px 16px", maxWidth: 1200, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>⚡ Slack Health Dashboard <span style={{ color: "#6366f1" }}>· Vizzia</span></div>
            <div style={{ fontSize: 11, color: "#6b6b8a", marginTop: 4 }}>
              {data?.updatedAt ? `Mis à jour le ${new Date(data.updatedAt).toLocaleString("fr-FR")}` : "Chargement…"} · 200 derniers messages / channel · channels publics uniquement
            </div>
          </div>
          <button onClick={fetchData} disabled={loading} style={{ background: loading ? "#2d2d44" : "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 10, padding: "9px 18px", color: "#fff", fontWeight: 600, fontSize: 12, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            {loading ? <><Spinner /> Synchronisation…</> : "🔄 Run Update"}
          </button>
        </div>

        {/* Main tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#13131f", borderRadius: 11, padding: 4, flexWrap: "wrap" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? "#6366f1" : "transparent", border: "none", borderRadius: 8, padding: "7px 13px", color: tab === t.id ? "#fff" : "#a0a0bf", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
              {t.l}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10, marginBottom: 20 }}>
              <KpiCard icon="✅" label="Compliance globale" value={`${pct(compliantAll, total)}%`} sub={`${compliantAll}/${total} channels`} color={sc(pct(compliantAll, total))} />
              <KpiCard icon="📝" label="Avec description" value={`${pct(withDesc, total)}%`} sub={`${withDesc}/${total}`} color="#f472b6" />
              <KpiCard icon="🏷️" label="Avec topic" value={`${pct(withTopic, total)}%`} sub={`${withTopic}/${total}`} color="#fb923c" />
              <KpiCard icon="😴" label="Dormants +90j" value={dormantChs.length} sub={`dont ${tempDormant.length} temp-`} color={dormantChs.length > 5 ? "#ef4444" : "#f59e0b"} />
              <KpiCard icon="👥" label="Membres actifs" value={people.length} color="#22c55e" />
              <KpiCard icon="📡" label="Channels publics" value={total} color="#22d3ee" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              <div style={{ background: "#1e1e2e", borderRadius: 14, padding: 18, border: "1px solid #2d2d44" }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14 }}>📊 Compliance Breakdown</div>
                {[
                  { l: "Naming Convention", v: pct(channels.filter(c => c.namingOk).length, total) },
                  { l: "Topic renseigné", v: pct(withTopic, total) },
                  { l: "Description renseignée", v: pct(withDesc, total) },
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
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14 }}>🏆 Top mentions (90 jours)</div>
                {[...people].sort((a, b) => b.mentions3m - a.mentions3m).slice(0, 8).map((m, i) => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                    <span style={{ fontSize: 10, color: "#6b6b8a", width: 14 }}>{i + 1}</span>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>
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
                {nonCompliant.length > 0 && <div style={{ background: "#450a0a", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#fca5a5" }}>⚠️ <strong>{nonCompliant.length}</strong> channels non-compliant</div>}
                {tempDormant.length > 0 && <div style={{ background: "#3f1a00", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#fdba74" }}>🗄️ <strong>{tempDormant.length}</strong> channels temp- inactifs depuis +90j</div>}
                {dormant.length > 0 && <div style={{ background: "#1e2a3a", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#93c5fd" }}>💤 <strong>{dormant.length}</strong> autres channels dormants</div>}
                {groupDms.filter(g => g.messages3m >= 50).length > 0 && <div style={{ background: "#1a1a3a", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#c4b5fd" }}>💬 <strong>{groupDms.filter(g => g.messages3m >= 50).length}</strong> group DMs très actifs → suggérer un channel</div>}
                {lowThread.length > 0 && <div style={{ background: "#2d0a2e", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#f0abfc" }}>🧵 <strong>{lowThread.length}</strong> membres avec moins de 80% de thread</div>}
                {lowPub.length > 0 && <div style={{ background: "#052e16", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#86efac" }}>🔒 <strong>{lowPub.length}</strong> membres avec moins de 80% de messages publics</div>}
              </div>
            </div>
          </div>
        )}

        {/* ── CHANNELS ── */}
        {tab === "channels" && (
          <div>
            <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#13131f", borderRadius: 10, padding: 4, flexWrap: "wrap" }}>
              {CH_TABS.map(t => (
                <button key={t.id} onClick={() => setChTab(t.id)} style={{ background: chTab === t.id ? "#4f46e5" : "transparent", border: "none", borderRadius: 7, padding: "6px 12px", color: chTab === t.id ? "#fff" : "#a0a0bf", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>
                  {t.l}
                </button>
              ))}
            </div>
            <div style={{ background: "#1e1e2e", borderRadius: 14, border: "1px solid #2d2d44", overflow: "hidden" }}>
              {chTab === "all" && <ChannelTable list={pubChannels} />}
              {chTab === "compliant" && <ChannelTable list={compliant} />}
              {chTab === "noncompliant" && <ChannelTable list={nonCompliant} />}
              {chTab === "dormant" && <ChannelTable list={dormant} />}
              {chTab === "temp" && <ChannelTable list={temp} />}
            </div>
          </div>
        )}

        {/* ── PEOPLE ── */}
        {tab === "people" && (
          <div>
            <div style={{ background: "#1e1e2e", borderRadius: 12, padding: "12px 16px", marginBottom: 16, border: "1px solid #2d2d44" }}>
              <div style={{ fontSize: 11, color: "#6b6b8a", marginBottom: 8 }}>Classer par :</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {PEOPLE_SORT.map(o => (
                  <button key={o.key} onClick={() => setMbSort(o.key)} style={{ background: mbSort === o.key ? o.color : "#13131f", border: `1px solid ${mbSort === o.key ? o.color : "#2d2d44"}`, borderRadius: 20, padding: "5px 12px", color: mbSort === o.key ? "#fff" : "#a0a0bf", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr repeat(6,1fr)", gap: 4, padding: "6px 14px", marginBottom: 4 }}>
              <div style={{ fontSize: 10, color: "#6b6b8a" }}>Membre</div>
              {PEOPLE_SORT.map(o => (
                <div key={o.key} style={{ fontSize: 10, color: mbSort === o.key ? o.color : "#6b6b8a", textAlign: "center", fontWeight: mbSort === o.key ? 700 : 400 }}>{o.label}</div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {[...people].sort((a, b) => b[mbSort] - a[mbSort]).map((m, rank) => (
                <div key={m.id} style={{ background: "#1e1e2e", borderRadius: 10, border: "1px solid #2d2d44", padding: "10px 14px", display: "grid", gridTemplateColumns: "2fr repeat(6,1fr)", gap: 4, alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 11, color: "#6b6b8a", width: 18, flexShrink: 0 }}>#{rank + 1}</span>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                      {m.avatar ? <img src={m.avatar} style={{ width: 32, height: 32 }} alt="" /> : m.name[0]}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                      {m.title && <div style={{ fontSize: 10, color: "#6b6b8a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.title}</div>}
                    </div>
                  </div>
                  <KpiCell value={m.mentions3m}            label="mentions"      color="#a78bfa" active={mbSort === "mentions3m"} />
                  <KpiCell value={m.msgSent}               label="messages"      color="#22d3ee" active={mbSort === "msgSent"} />
                  <KpiCell value={`${m.threadPct ?? 0}%`}  label="thread pub"    color="#f472b6" active={mbSort === "threadPct"} />
                  <KpiCell value={`${m.pubPct}%`}          label="pub ratio"     color="#22c55e" active={mbSort === "pubPct"} />
                  <KpiCell value={m.reactionsGiven}        label="réac. données" color="#f59e0b" active={mbSort === "reactionsGiven"} />
                  <KpiCell value={m.reactionsReceived}     label="réac. reçues"  color="#fb923c" active={mbSort === "reactionsReceived"} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── GROUP DMS ── */}
        {tab === "groupdms" && (
          <div>
            <div style={{ background: "#1a1a3a", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#c4b5fd", border: "1px solid #4c1d95" }}>
              💬 <strong>{groupDms.length} Group DMs</strong> · messages postés sur les <strong>90 derniers jours</strong>
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
                        <div style={{ fontSize: 9, color: "#6b6b8a" }}>messages (90j)</div>
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
                          <button onClick={() => doNotify(helpSlackChannel.id, `💬 Le group DM entre *${g.members.join(", ")}* est très actif (${g.messages3m} msgs en 90j). Envisagez de créer un channel dédié !`, g.name)}
                            style={{ background: "linear-gradient(135deg,#5b21b6,#7c3aed)", border: "none", borderRadius: 8, padding: "7px 14px", color: "#fff", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>
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

        {/* ── USER GROUPS ── */}
        {tab === "usergroups" && (
          <div>
            {groups.length === 0 ? (
              <div style={{ background: "#1e1e2e", borderRadius: 14, padding: 32, border: "1px solid #2d2d44", textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🏷️</div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Aucun User Group trouvé</div>
                <div style={{ fontSize: 12, color: "#6b6b8a", maxWidth: 360, margin: "0 auto" }}>Crée des User Groups dans <strong>Slack Admin → People → User Groups</strong>, puis clique "Run Update".</div>
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
                          <div style={{ fontSize: 9, color: "#6b6b8a" }}>mentions (90j)</div>
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

        {/* ── BEST PRACTICES ── */}
        {tab === "bestpractices" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Resources */}
            <div style={{ background: "#1e1e2e", borderRadius: 14, padding: 18, border: "1px solid #2d2d44" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14 }}>🔗 Ressources</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { icon: "🎓", label: "Formation Slack", sub: "How to use Slack — Training", url: "https://www.notion.so/vizzia/How-to-use-Slack-Training-31245c4b899e8098b764c3c811cece02" },
                  { icon: "📖", label: "Playbook Slack", sub: "How to use Slack — Playbook", url: "https://www.notion.so/vizzia/How-to-use-Slack-Playbook-31245c4b899e804990f8ccd3d8c036c7" },
                  { icon: "🏷️", label: "Naming Convention", sub: "Conventions de nommage des channels", url: "https://www.notion.so/vizzia/Slack-Channels-Naming-2e745c4b899e80038d67d93760f29717" },
                ].map(r => (
                  <a key={r.url} href={r.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 12, background: "#13131f", borderRadius: 10, padding: "12px 16px", border: "1px solid #2d2d44", textDecoration: "none", transition: "border-color .2s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "#6366f1"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "#2d2d44"}>
                    <div style={{ fontSize: 24, flexShrink: 0 }}>{r.icon}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#e2e2f0" }}>{r.label}</div>
                      <div style={{ fontSize: 11, color: "#6b6b8a", marginTop: 2 }}>{r.sub}</div>
                    </div>
                    <div style={{ marginLeft: "auto", fontSize: 12, color: "#6366f1" }}>↗</div>
                  </a>
                ))}
              </div>
            </div>

            {/* Best practices cards */}
            <div style={{ fontWeight: 700, fontSize: 13, color: "#a0a0bf" }}>✨ Best Practices</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {[
                { icon: "🧵", color: "#ede9fe", border: "#c4b5fd", iconBg: "#7c3aed", title: "Reply in threads", lines: ["Keeps the main channel readable and discussions organized", "1 post = 1 topic"] },
                { icon: "📋", color: "#fefce8", border: "#fde68a", iconBg: "#d97706", title: "Name channels clearly, add topic + description", lines: ["Follow naming conventions so everyone understands the purpose instantly", "Explain channel purpose with clear and short topic + description"] },
                { icon: "✅", color: "#f0fdf4", border: "#bbf7d0", iconBg: "#16a34a", title: "React, don't reply", lines: ["Use emoji reactions for quick acknowledgements to reduce noise"] },
                { icon: "💬", color: "#eff6ff", border: "#bfdbfe", iconBg: "#2563eb", title: "Default to channels", lines: ["Use channels for shared topics — keep knowledge visible and searchable", "Use DMs for private only"] },
                { icon: "🔔", color: "#fff7ed", border: "#fed7aa", iconBg: "#ea580c", title: "Manage notifications wisely", lines: ["Tag for emergencies only", "Follow only key channels to protect focus and reduce interruptions"] },
                { icon: "📌", color: "#fff1f2", border: "#fecdd3", iconBg: "#e11d48", title: "Pin key messages", lines: ["Highlight important decisions, resources, or links for easy access"] },
              ].map(bp => (
                <div key={bp.title} style={{ background: bp.color, borderRadius: 14, padding: "16px 18px", border: `1px solid ${bp.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: bp.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{bp.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1a2e" }}>{bp.title}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {bp.lines.map((l, i) => (
                      <div key={i} style={{ fontSize: 12, color: "#374151" }}>{l}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ACTIONS ── */}
        {tab === "actions" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Action sub-tabs */}
            <div style={{ display: "flex", gap: 4, background: "#13131f", borderRadius: 10, padding: 4, flexWrap: "wrap" }}>
              {ACTION_TABS.map(t => (
                <button key={t.id} onClick={() => setActionTab(t.id)} style={{ background: actionTab === t.id ? "#4f46e5" : "transparent", border: "none", borderRadius: 7, padding: "6px 14px", color: actionTab === t.id ? "#fff" : "#a0a0bf", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>
                  {t.l}
                </button>
              ))}
            </div>

            <div style={{ background: "#1e1e2e", borderRadius: 14, padding: 18, border: "1px solid #2d2d44" }}>
              {actionTab === "noncompliant" && <ActionNonCompliant />}
              {actionTab === "dormant"      && <ActionDormant />}
              {actionTab === "temp"         && <ActionTemp />}
              {actionTab === "thread"       && <ActionThread />}
              {actionTab === "pubpriv"      && <ActionPubPriv />}
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
