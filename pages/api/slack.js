import { WebClient } from "@slack/web-api";

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

const VALID_PREFIXES = [
  "bizops-","compliance-","corecliot-","cs-","dataplat-","dlm-","finance-",
  "hardware-","hr-","marketing-","netsec-","ops-","plateng-","sales-",
  "talent-acquisition-","product-","safety-","waste-","legal-","proj-",
  "ext-","help-","intel-","social-","temp-","taskforce-","coreplat-",
  "delivery-","foundation-","hardprod-","softprod-","revenue-","tech-","org-",
  "general","random"
];

function isCompliant(ch) {
  const hasPrefix = VALID_PREFIXES.some(p => ch.name.startsWith(p));
  const hasLower = ch.name === ch.name.toLowerCase();
  const noSpace = !ch.name.includes(" ");
  return {
    naming: hasPrefix && hasLower && noSpace,
    topic: !!ch.topic?.value,
    desc: !!ch.purpose?.value,
  };
}

async function fetchAll(method, params, key) {
  let cursor, results = [];
  do {
    const res = await slack.apiCall(method, { ...params, limit: 200, cursor });
    results = results.concat(res[key] || []);
    cursor = res.response_metadata?.next_cursor;
  } while (cursor);
  return results;
}

// Fetch ALL messages for a channel since oldest (paginated)
async function fetchAllMessages(channelId, oldest) {
  let cursor, msgs = [];
  do {
    const res = await slack.conversations.history({
      channel: channelId,
      limit: 200,
      oldest,
      cursor,
    });
    msgs = msgs.concat(res.messages || []);
    cursor = res.response_metadata?.next_cursor;
  } while (cursor);
  return msgs;
}

function ninetyDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return Math.floor(d.getTime() / 1000);
}

// Rate-limit-safe parallel execution (batch of N)
async function batchMap(arr, fn, batchSize = 10) {
  const results = [];
  for (let i = 0; i < arr.length; i += batchSize) {
    const batch = arr.slice(i, i + batchSize);
    const res = await Promise.all(batch.map(fn));
    results.push(...res);
    if (i + batchSize < arr.length) await new Promise(r => setTimeout(r, 300));
  }
  return results;
}

// Fetch messages with a per-channel timeout
async function fetchMessages(channelId, oldest) {
  try {
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 2000));
    const fetch = slack.conversations.history({ channel: channelId, limit: 200, oldest });
    const res = await Promise.race([fetch, timeout]);
    return res.messages || [];
  } catch (_) { return []; }
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const action = req.query.action;

  try {
    if (action === "archive") {
      const { channelId } = req.query;
      await slack.conversations.archive({ channel: channelId });
      return res.json({ ok: true });
    }

    if (action === "notify") {
      const { channelId, message } = req.query;
      await slack.chat.postMessage({ channel: channelId, text: message, mrkdwn: true });
      return res.json({ ok: true });
    }

    const oldest = String(ninetyDaysAgo());

    // 1. Channels
    const [pubChannels, privChannels] = await Promise.all([
      fetchAll("conversations.list", { types: "public_channel", exclude_archived: true }, "channels"),
      fetchAll("conversations.list", { types: "private_channel", exclude_archived: true }, "channels"),
    ]);
    const allChannels = [...pubChannels, ...privChannels];

    // 2. Members
    const members = await fetchAll("users.list", {}, "members");
    const activeMembers = members.filter(m => !m.deleted && !m.is_bot && m.id !== "USLACKBOT");

    // 3. User Groups
    let userGroups = [];
    try {
      const ugRes = await slack.usergroups.list({ include_users: true });
      userGroups = ugRes.usergroups || [];
    } catch (_) {}

    // 4. Group DMs
    const mpims = await fetchAll("conversations.list", { types: "mpim", exclude_archived: true }, "channels");

    // 5. Per-channel stats + per-user stats
    const channelStats = {};
    const memberStats = {};
    for (const m of activeMembers) {
      memberStats[m.id] = {
        msgSent: 0, publicMsgs: 0, privateMsgs: 0,
        threadMsgsInPublic: 0,
        reactionsGiven: 0, reactionsReceived: 0, mentions: 0,
      };
    }
    const ugStats = {};

    // Process ALL channels in parallel (each has 2s timeout, total stays under 9s)
    await Promise.all(allChannels.map(async ch => {
      try {
        const msgs = await fetchMessages(ch.id, oldest);
        const lastMsg = msgs[0]?.ts ? Math.floor(Number(msgs[0].ts)) : null;
        const threadReplies = msgs.filter(m => m.thread_ts && m.thread_ts !== m.ts).length;
        const threadRatio = msgs.length > 0 ? threadReplies / msgs.length : 0;
        channelStats[ch.id] = { lastMsg, threadRatio, msgCount: msgs.length };

        for (const msg of msgs) {
          if (!msg.user || !memberStats[msg.user]) continue;
          const s = memberStats[msg.user];
          s.msgSent++;
          if (ch.is_private) {
            s.privateMsgs++;
          } else {
            s.publicMsgs++;
            // count thread messages on public channels
            if (msg.thread_ts && msg.thread_ts !== msg.ts) {
              s.threadMsgsInPublic++;
            }
          }
          // reactions received
          for (const r of (msg.reactions || [])) {
            s.reactionsReceived += r.count;
            for (const uid of (r.users || [])) {
              if (memberStats[uid]) memberStats[uid].reactionsGiven++;
            }
          }
          // mentions
          const mentionMatches = (msg.text || "").match(/<@U[A-Z0-9]+>/g) || [];
          for (const mention of mentionMatches) {
            const uid = mention.replace(/<@|>/g, "");
            if (memberStats[uid]) memberStats[uid].mentions++;
          }
          // user group mentions
          const ugMatches = (msg.text || "").match(/<!subteam\^([A-Z0-9]+)\|/g) || [];
          for (const m of ugMatches) {
            const ugId = m.replace("<!subteam^", "").replace("|", "");
            ugStats[ugId] = (ugStats[ugId] || 0) + 1;
          }
        }
      } catch (_) {
        channelStats[ch.id] = { lastMsg: null, threadRatio: 0, msgCount: 0 };
      }
    }, 8);

    // 6. Group DM stats
    const groupDmStats = {};
    await Promise.all(mpims.map(async mpim => {
      const msgs = await fetchMessages(mpim.id, oldest);
      groupDmStats[mpim.id] = { messages3m: msgs.length, memberIds: mpim.members || [] };
    }));

    // Build response
    const now = Math.floor(Date.now() / 1000);

    const channels = allChannels.map(ch => {
      const c = isCompliant(ch);
      const stats = channelStats[ch.id] || {};
      const daysSinceLast = stats.lastMsg ? Math.floor((now - stats.lastMsg) / 86400) : 999;
      return {
        id: ch.id, name: ch.name, isPrivate: ch.is_private,
        hasTopic: c.topic, hasDesc: c.desc, namingOk: c.naming,
        fullyCompliant: c.naming && !!ch.topic?.value && !!ch.purpose?.value,
        owner: ch.creator,
        created: new Date(ch.created * 1000).toISOString().split("T")[0],
        lastActive: daysSinceLast,
        threadRatio: Math.round((stats.threadRatio || 0) * 100),
        msgCount: stats.msgCount || 0,
        topicValue: ch.topic?.value || "",
        descValue: ch.purpose?.value || "",
      };
    });

    const people = activeMembers.map(m => {
      const s = memberStats[m.id] || {};
      const total = (s.publicMsgs || 0) + (s.privateMsgs || 0);
      const pubPct = total > 0 ? Math.round((s.publicMsgs / total) * 100) : 0;
      const threadPct = s.publicMsgs > 0 ? Math.round((s.threadMsgsInPublic / s.publicMsgs) * 100) : 0;
      return {
        id: m.id,
        name: m.real_name || m.name,
        displayName: m.profile?.display_name || m.name,
        avatar: m.profile?.image_48,
        title: m.profile?.title || "",
        msgSent: s.msgSent || 0,
        publicMsgs: s.publicMsgs || 0,
        privateMsgs: s.privateMsgs || 0,
        pubPct,
        threadPct, // % messages in thread on public channels
        reactionsGiven: s.reactionsGiven || 0,
        reactionsReceived: s.reactionsReceived || 0,
        mentions3m: s.mentions || 0,
      };
    });

    const groupDms = mpims.map(mpim => {
      const s = groupDmStats[mpim.id] || {};
      const memberNames = (s.memberIds || []).map(uid => {
        const u = activeMembers.find(m => m.id === uid);
        return u ? (u.profile?.display_name || u.real_name || u.name) : uid;
      });
      return { id: mpim.id, name: mpim.name, members: memberNames, messages3m: s.messages3m || 0 };
    });

    const groups = userGroups.map(ug => ({
      id: ug.id, handle: `@${ug.handle}`, name: ug.name,
      description: ug.description || "",
      memberCount: ug.user_count || 0,
      memberIds: ug.users || [],
      memberNames: (ug.users || []).map(uid => {
        const u = activeMembers.find(m => m.id === uid);
        return u ? (u.profile?.display_name || u.real_name) : uid;
      }),
      mentions3m: ugStats[ug.id] || 0,
    }));

    return res.json({ ok: true, updatedAt: new Date().toISOString(), channels, people, groupDms, groups });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
