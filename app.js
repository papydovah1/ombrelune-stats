// State
let currentConfig = {};
let lastRawData = {
  period1Messages: null,
  period2Messages: null,
  p1Range: null,
  p2Range: null
};
let computedStats = {
  p1: null,
  p2: null
};
let activePeriodTab = 'p1';
let activeEmployeeTab = 'p1';
let activeCompTab = 'p1';
let selectedCompany = '';
let activeSessionFilter = 'all';
let progressInterval = null;
let lastAiStats = null;
let isPublicReadOnly = false;
let publicBounds = null; // { minMs, maxMs, minDateStr, maxDateStr, publishedAt }

// DOM Elements
const els = {
  adminHeaderActions: document.getElementById('adminHeaderActions'),
  btnPublishOnline: document.getElementById('btnPublishOnline'),
  publicRangeBanner: document.getElementById('publicRangeBanner'),
  publishStatusBox: document.getElementById('publishStatusBox'),
  localCacheOptions: document.getElementById('localCacheOptions'),
  btnToggleConfig: document.getElementById('btnToggleConfig'),
  channelStatusPill: document.getElementById('channelStatusPill'),
  configPanel: document.getElementById('configPanel'),
  btnToggleHelp: document.getElementById('btnToggleHelp'),
  helpBox: document.getElementById('helpBox'),
  channelInput: document.getElementById('channelInput'),
  resolvedChannelHint: document.getElementById('resolvedChannelHint'),
  tokenInput: document.getElementById('tokenInput'),
  btnToggleToken: document.getElementById('btnToggleToken'),
  geminiKey: document.getElementById('geminiKey'),
  btnToggleGeminiKey: document.getElementById('btnToggleGeminiKey'),
  geminiModel: document.getElementById('geminiModel'),
  btnTestGemini: document.getElementById('btnTestGemini'),
  geminiTestResult: document.getElementById('geminiTestResult'),
  allowedCompanies: document.getElementById('allowedCompanies'),
  aiConfidencePct: document.getElementById('aiConfidencePct'),
  companySelect: document.getElementById('companySelect'),
  companyHint: document.getElementById('companyHint'),
  aiNotice: document.getElementById('aiNotice'),
  compTabP1: document.getElementById('compTabP1'),
  compTabP2: document.getElementById('compTabP2'),
  companiesTableHead: document.getElementById('companiesTableHead'),
  companiesTableBody: document.getElementById('companiesTableBody'),
  pillUncertain: document.getElementById('pillUncertain'),
  openKeyword: document.getElementById('openKeyword'),
  closeKeyword: document.getElementById('closeKeyword'),
  forfaitMinutes: document.getElementById('forfaitMinutes'),
  maxSessionHours: document.getElementById('maxSessionHours'),
  dedupMinutes: document.getElementById('dedupMinutes'),
  countOrphanCloseAsForfait: document.getElementById('countOrphanCloseAsForfait'),
  btnTestConnection: document.getElementById('btnTestConnection'),
  btnSaveConfig: document.getElementById('btnSaveConfig'),
  testPreviewBox: document.getElementById('testPreviewBox'),

  p1Label: document.getElementById('p1Label'),
  p1Start: document.getElementById('p1Start'),
  p1StartTime: document.getElementById('p1StartTime'),
  p1End: document.getElementById('p1End'),
  p1EndTime: document.getElementById('p1EndTime'),
  p2Enabled: document.getElementById('p2Enabled'),
  period2Container: document.getElementById('period2Container'),
  p2Label: document.getElementById('p2Label'),
  p2Start: document.getElementById('p2Start'),
  p2StartTime: document.getElementById('p2StartTime'),
  p2End: document.getElementById('p2End'),
  p2EndTime: document.getElementById('p2EndTime'),

  useCacheCheckbox: document.getElementById('useCacheCheckbox'),
  btnClearCache: document.getElementById('btnClearCache'),
  btnAnalyze: document.getElementById('btnAnalyze'),

  progressContainer: document.getElementById('progressContainer'),
  progressText: document.getElementById('progressText'),
  progressPercent: document.getElementById('progressPercent'),
  progressBar: document.getElementById('progressBar'),
  errorBanner: document.getElementById('errorBanner'),

  resultsSection: document.getElementById('resultsSection'),
  kpiTotalP1: document.getElementById('kpiTotalP1'),
  kpiTotalCompare: document.getElementById('kpiTotalCompare'),
  kpiAvgDayP1: document.getElementById('kpiAvgDayP1'),
  kpiAvgDayCompare: document.getElementById('kpiAvgDayCompare'),
  kpiCountP1: document.getElementById('kpiCountP1'),
  kpiCountCompare: document.getElementById('kpiCountCompare'),
  kpiForfaitP1: document.getElementById('kpiForfaitP1'),
  kpiForfaitCompare: document.getElementById('kpiForfaitCompare'),

  thP1Name: document.getElementById('thP1Name'),
  thP2Name: document.getElementById('thP2Name'),
  thDiff: document.getElementById('thDiff'),
  comparisonTableBody: document.getElementById('comparisonTableBody'),
  btnExportCsv: document.getElementById('btnExportCsv'),

  empTabP1: document.getElementById('empTabP1'),
  empTabP2: document.getElementById('empTabP2'),
  empTabCompare: document.getElementById('empTabCompare'),
  employeesTableHead: document.getElementById('employeesTableHead'),
  employeesTableBody: document.getElementById('employeesTableBody'),

  dailyChartsContainer: document.getElementById('dailyChartsContainer'),
  chartTitleP1: document.getElementById('chartTitleP1'),
  chartTitleP2: document.getElementById('chartTitleP2'),
  chartColP2: document.getElementById('chartColP2'),
  dailyBarsP1: document.getElementById('dailyBarsP1'),
  dailyBarsP2: document.getElementById('dailyBarsP2'),

  tabBtnP1: document.getElementById('tabBtnP1'),
  tabBtnP2: document.getElementById('tabBtnP2'),
  sessionsTableBody: document.getElementById('sessionsTableBody')
};

// Normalization helper (case-insensitive, accent-insensitive)
function normalizeStr(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract employee initials / signatures from a message or embed
function extractSignatures(msg) {
  let bodyText = '';
  if (Array.isArray(msg.embeds) && msg.embeds.length > 0) {
    const emb = msg.embeds[0];
    bodyText = [emb.description || '', ...(emb.fields || []).map((f) => `${f.name || ''} ${f.value || ''}`)].join('\n').trim();
  }
  if (!bodyText) {
    bodyText = (msg.content || msg.fullText || '').trim();
  }

  const lines = bodyText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const lastLine = lines.length > 0 ? lines[lines.length - 1] : '';
  const tailText = bodyText.slice(-90);

  const found = new Set();

  // 1. Initiales classiques (ex: "T.V.", "R.B", "-E.M.-", "🔥G.M", "🌸🐾D.F", "J-C")
  const initRegex = /(?:^|[^A-Za-zÀ-ÿ])([A-Za-z])\s*[.\-]\s*([A-Za-z])\.?(?=$|[^A-Za-zÀ-ÿ])/g;
  let match;
  while ((match = initRegex.exec(tailText)) !== null) {
    found.add(`${match[1].toUpperCase()}.${match[2].toUpperCase()}`);
  }

  // 2. Prénom + Initiale (ex: "Veyra.C", "Zara.D", "Euphya P.", "Aslan B.", "Aster V.", "Monarko.L")
  const firstPlusInit = /(?:^|[^A-Za-zÀ-ÿ])([A-ZÀ-Ý][a-zà-ÿ]{2,15})(?:\s*\.\s*|\s+)([A-Z])\.?(?=$|[^A-Za-zÀ-ÿ])/g;
  while ((match = firstPlusInit.exec(tailText)) !== null) {
    const word = match[1].toLowerCase();
    if (!['monsieur', 'madame', 'mademoiselle', 'bonsoir', 'bonjour', 'prochaine', 'merci', 'ouverte', 'portes'].includes(word)) {
      found.add(`${match[1][0].toUpperCase()}.${match[2].toUpperCase()}`);
    }
  }

  // 3. Initiale + Nom (ex: "D.Valemor", "D.Silver")
  const initPlusLast = /(?:^|[^A-Za-zÀ-ÿ])([A-Z])\s*\.\s*([A-ZÀ-Ý][a-zà-ÿ]{2,15})(?=$|[^A-Za-zÀ-ÿ])/g;
  while ((match = initPlusLast.exec(tailText)) !== null) {
    if (match[1].toUpperCase() !== 'M') {
      found.add(`${match[1].toUpperCase()}.${match[2][0].toUpperCase()}`);
    }
  }

  // 4. Noms complets récurrents en signature de fin de ligne
  if (/theo\s+veyren|\|\s*theo\s*$/i.test(lastLine)) found.add('T.V');
  if (/daesya\s+sangvyr/i.test(lastLine)) found.add('D.S');
  if (/thalea\s+azharys|thaléa\s+azharys/i.test(lastLine)) found.add('T.A');
  if (/gary\s+myria/i.test(lastLine)) found.add('G.M');
  if (/jack\s+smith/i.test(lastLine)) found.add('J.S');

  return found.size > 0 ? Array.from(found) : ['Non signé'];
}

function renderSigBadges(sigs) {
  if (!sigs || sigs.length === 0) {
    return `<span class="sig-badge sig-unsigned">Non signé</span>`;
  }
  return sigs.map((s) => {
    const isUnsigned = s === 'Non signé';
    return `<span class="sig-badge ${isUnsigned ? 'sig-unsigned' : ''}">${escapeHtml(s)}</span>`;
  }).join('');
}

// Phrases « certaines » (séparées par |), insensibles à la casse et aux accents
function splitPhrases(value) {
  return (value || '').split('|').map((s) => normalizeStr(s)).filter(Boolean);
}

// Règles : retourne 'OPEN', 'CLOSE', ou null si aucune phrase connue ne correspond
function ruleClassify(fullText, openKeyword, closeKeyword) {
  const normText = normalizeStr(fullText);

  for (const p of splitPhrases(openKeyword)) {
    if (normText.includes(p)) return 'OPEN';
  }
  for (const p of splitPhrases(closeKeyword)) {
    // tolère singulier/pluriel sur "referment" / "referme"
    const alt = p.replace(/referment\b/g, 'referme');
    if (normText.includes(p) || (alt && normText.includes(alt))) return 'CLOSE';
  }
  return null;
}

const DEFAULT_ALLOWED_COMPANIES = 'Ombrelune | Forge Ostankia | Le Contresort | Providis | Clauser | Banque | Arkana TCG | Cabinet Floravet';
const CUE_REGEX = /ferm|ouvr|ouvert|porte|eteign|accueill|prochain/;

function getAiConfidenceThreshold() {
  const pct = Number(els.aiConfidencePct && els.aiConfidencePct.value);
  return (pct >= 50 && pct <= 100 ? pct : 90) / 100;
}

function isAllowedCompanyKey(companyKey) {
  const raw = (els.allowedCompanies && els.allowedCompanies.value) || DEFAULT_ALLOWED_COMPANIES;
  const allowedList = splitPhrases(raw);
  if (allowedList.length === 0) return true;
  return allowedList.includes(companyKey);
}

const RELANCE_OR_FUTURE_REGEX = /encore ouvert|toujours ouvert|continue de vous accueillir|reste ouvert|\bouvrira\b|\bouvriront\b|ce soir a \d{1,2}\s*h|ouvre ses portes a \d{1,2}\s*h|ouverture a \d{1,2}\s*h|soyez au rendez-vous|vous donne rendez-vous/;

// Résolution du type d'une annonce : correction manuelle > règles > IA (annotée par le serveur)
function resolveMessageType(m, openKeyword, closeKeyword) {
  if (m.userType) return { type: m.userType, source: 'user', uncertain: false };

  const normText = normalizeStr(m.fullText);

  const rule = ruleClassify(m.fullText, openKeyword, closeKeyword);
  if (rule) return { type: rule, source: 'rule', uncertain: false };

  // Si l'annonce est une relance ("est encore ouverte", "continue de vous accueillir") ou au futur ("ouvrira"), ce n'est pas une ouverture
  if (RELANCE_OR_FUTURE_REGEX.test(normText)) {
    return { type: 'OTHER', source: 'rule_relance', uncertain: false };
  }

  if (m.aiType) {
    return { type: m.aiType, source: 'ai', uncertain: (typeof m.aiConf === 'number' ? m.aiConf : 0) < getAiConfidenceThreshold() };
  }

  // Non classée (pas de clé IA, quota atteint...) : à confirmer seulement si le texte parle d'ouverture/fermeture
  return { type: 'OTHER', source: 'none', uncertain: CUE_REGEX.test(normText) };
}

// Format minutes into "Xh Ym"
function formatDuration(totalMinutes) {
  const mins = Math.round(Math.max(0, totalMinutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

// Format date in French (e.g. "Lun 12/10/2026")
function formatDateShort(ms) {
  const d = new Date(ms);
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const dayName = days[d.getDay()];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dayName} ${dd}/${mm}/${yyyy}`;
}

function formatTimeHM(ms) {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Clé de journée RP (une journée RP débute à shiftHours, par défaut 15h00, et finit le lendemain à 14h59)
const RP_SHIFT_MS = 15 * 3600 * 1000;

function toLocalDateKey(ms, shiftMs = 0) {
  const d = new Date(ms - shiftMs);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseTimeHM(timeStr, defaultH, defaultM) {
  if (!timeStr || !timeStr.includes(':')) return [defaultH, defaultM];
  const [h, m] = timeStr.split(':').map(Number);
  return [Number.isFinite(h) ? h : defaultH, Number.isFinite(m) ? m : defaultM];
}

function dateInputToStartMs(dateStr, timeStr = '15:00') {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = parseTimeHM(timeStr, 15, 0);
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}

function dateInputToEndMs(dateStr, timeStr = '14:59') {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = parseTimeHM(timeStr, 14, 59);
  return new Date(y, m - 1, d, hh, mm, 59, 999).getTime();
}

function formatDateInput(dateObj) {
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Core Analysis Engine for a Period
function analyzePeriod(rawMessages, startMs, endMs, rules, companyKey) {
  const openKeyword = rules.openKeyword || 'Ombrelune ouvre ses porte';
  const closeKeyword = rules.closeKeyword || 'Ombrelune se referment';
  const forfaitMinutes = Number(rules.forfaitMinutes) >= 0 ? Number(rules.forfaitMinutes) : 30;
  const maxSessionMinutes = (Number(rules.maxSessionHours) || 8) * 60;
  const dedupMs = (Number(rules.dedupMinutes) >= 0 ? Number(rules.dedupMinutes) : 2) * 60 * 1000;
  const countOrphanClose = Boolean(rules.countOrphanCloseAsForfait);

  // Une analyse porte sur UNE entreprise (titre d'embed) : sinon les ouvertures/fermetures de plusieurs entreprises se mélangeraient
  const sorted = [...(rawMessages || [])]
    .filter((m) => !companyKey || m.companyKey === companyKey)
    .sort((a, b) => a.timestampMs - b.timestampMs);

  // Classify & Deduplicate
  const classified = [];
  let lastActionType = null;
  let lastActionTs = 0;

  for (const m of sorted) {
    const signatures = extractSignatures(m);
    const resolved = resolveMessageType(m, openKeyword, closeKeyword);
    const type = resolved.type; // OPEN, CLOSE, WARN (préavis, ignoré) ou OTHER
    const meta = { source: resolved.source, uncertain: resolved.uncertain };

    if (type === 'OPEN' || type === 'CLOSE') {
      if (type === lastActionType && (m.timestampMs - lastActionTs) <= dedupMs) {
        classified.push({ ...m, ...meta, signatures, eventType: 'DEDUP_IGNORED', originalType: type });
        continue;
      }
      lastActionType = type;
      lastActionTs = m.timestampMs;
    }
    classified.push({ ...m, ...meta, signatures, eventType: type });
  }

  // Pair OPEN and CLOSE across the buffered timeline
  const allSessions = [];
  const ignoredMessages = [];

  const actionEvents = [];
  for (const item of classified) {
    if (item.eventType === 'OPEN' || item.eventType === 'CLOSE') {
      actionEvents.push(item);
    } else if (item.timestampMs >= startMs && item.timestampMs <= endMs) {
      ignoredMessages.push(item);
    }
  }

  // Helper to combine open + close + relance signatures into unique participant list
  const getSessionParticipants = (...msgs) => {
    const set = new Set();
    for (const msg of msgs) {
      if (msg && Array.isArray(msg.signatures)) {
        msg.signatures.forEach((s) => { if (s !== 'Non signé') set.add(s); });
      }
    }
    return set.size > 0 ? Array.from(set) : ['Non signé'];
  };

  // Récupère les 5 annonces suivantes de la même entreprise après une ouverture (pour contrôle manuel d'un forfait)
  const getNextCandidates = (openMsg) => {
    if (!openMsg) return [];
    const idx = classified.findIndex((c) => c.id === openMsg.id);
    if (idx === -1) return [];
    return classified.slice(idx + 1, idx + 6);
  };

  const classifiedById = new Map(classified.map((c) => [c.id, c]));
  const consumedIds = new Set();

  let i = 0;
  while (i < actionEvents.length) {
    const curr = actionEvents[i];
    if (consumedIds.has(curr.id)) {
      i++;
      continue;
    }

    if (curr.eventType === 'OPEN') {
      // Si l'utilisateur a manuellement forcé ou validé le forfait sur cette ouverture
      if (curr.forcedForfait) {
        allSessions.push({
          anchorMs: curr.timestampMs,
          openMsg: curr,
          closeMsg: null,
          participants: getSessionParticipants(curr),
          durationMin: forfaitMinutes,
          normalMin: 0,
          forfaitMin: forfaitMinutes,
          category: 'forfait',
          confirmedForfait: true,
          statusLabel: `✅ Forfait ${forfaitMinutes}m appliqué`,
          crossesMidnight: false
        });
        i++;
        continue;
      }

      // Si l'utilisateur a manuellement lié cette ouverture à une annonce de fermeture précise
      if (curr.pairedCloseId && classifiedById.has(curr.pairedCloseId)) {
        const manualClose = classifiedById.get(curr.pairedCloseId);
        const diffMin = Math.max(1, (manualClose.timestampMs - curr.timestampMs) / 60000);
        consumedIds.add(manualClose.id);
        allSessions.push({
          anchorMs: curr.timestampMs,
          openMsg: curr,
          closeMsg: manualClose,
          participants: getSessionParticipants(curr, manualClose),
          durationMin: diffMin,
          normalMin: diffMin,
          forfaitMin: 0,
          category: 'normal',
          statusLabel: '✅ Session complète (liée manuellement)',
          crossesMidnight: toLocalDateKey(curr.timestampMs) !== toLocalDateKey(manualClose.timestampMs)
        });
        i++;
        continue;
      }

      // Si plusieurs annonces d'ouverture sont postées au cours du même service (ex: relance < 3h) avant la fermeture,
      // on ne les fusionne QUE si une fermeture valide suit dans la foulée (même journée RP).
      // Sinon chaque ouverture est traitée séparément pour ne pas absorber l'ouverture d'un service suivant.
      const extraOpens = [];
      let j = i + 1;
      while (
        j < actionEvents.length &&
        actionEvents[j].eventType === 'OPEN' &&
        !actionEvents[j].pairedCloseId &&
        !actionEvents[j].forcedForfait &&
        toLocalDateKey(actionEvents[j].timestampMs, RP_SHIFT_MS) === toLocalDateKey(curr.timestampMs, RP_SHIFT_MS) &&
        (actionEvents[j].timestampMs - actionEvents[j - 1].timestampMs) <= 180 * 60 * 1000
      ) {
        extraOpens.push(actionEvents[j]);
        j++;
      }

      const next = actionEvents[j];

      if (next && next.eventType === 'CLOSE' && ((next.timestampMs - curr.timestampMs) / 60000) <= maxSessionMinutes) {
        const diffMin = (next.timestampMs - curr.timestampMs) / 60000;
        // Valid Normal Session (de la 1re ouverture jusqu'à la fermeture)
        allSessions.push({
          anchorMs: curr.timestampMs,
          openMsg: curr,
          closeMsg: next,
          participants: getSessionParticipants(curr, ...extraOpens, next),
          durationMin: diffMin,
          normalMin: diffMin,
          forfaitMin: 0,
          category: 'normal',
          statusLabel: extraOpens.length > 0 ? `✅ Session complète (${extraOpens.length} relance)` : '✅ Session complète',
          crossesMidnight: toLocalDateKey(curr.timestampMs) !== toLocalDateKey(next.timestampMs)
        });
        i = j + 1;
        continue;
      } else {
        // Pas de fermeture valide pour curr -> curr seul passe en forfait (et on repart à i + 1 sans avaler extraOpens)
        const nextSingle = actionEvents[i + 1];
        const reasonExceeds = nextSingle && nextSingle.eventType === 'CLOSE' && ((nextSingle.timestampMs - curr.timestampMs) / 60000) > maxSessionMinutes;
        allSessions.push({
          anchorMs: curr.timestampMs,
          openMsg: curr,
          closeMsg: null,
          participants: getSessionParticipants(curr),
          nextCandidates: getNextCandidates(curr),
          durationMin: forfaitMinutes,
          normalMin: 0,
          forfaitMin: forfaitMinutes,
          category: 'forfait',
          statusLabel: reasonExceeds
            ? `⚠️ Oubli fermeture (> ${rules.maxSessionHours}h) → Forfait ${forfaitMinutes}m`
            : `⚠️ Oubli de fermeture → Forfait ${forfaitMinutes}m`,
          crossesMidnight: false
        });
        i = i + 1;
        continue;
      }
    } else if (curr.eventType === 'CLOSE') {
      // Orphan CLOSE (no preceding OPEN)
      if (countOrphanClose) {
        allSessions.push({
          anchorMs: curr.timestampMs,
          openMsg: null,
          closeMsg: curr,
          participants: getSessionParticipants(null, curr),
          durationMin: forfaitMinutes,
          normalMin: 0,
          forfaitMin: forfaitMinutes,
          category: 'forfait',
          statusLabel: `⚠️ Oubli d'ouverture → Forfait ${forfaitMinutes}m`,
          crossesMidnight: false
        });
      } else if (curr.timestampMs >= startMs && curr.timestampMs <= endMs) {
        ignoredMessages.push({
          ...curr,
          eventType: 'ORPHAN_CLOSE'
        });
      }
      i += 1;
    }
  }

  // Filter sessions whose anchorMs (opening time) falls inside [startMs, endMs]
  const periodSessions = allSessions.filter(
    (s) => s.anchorMs >= startMs && s.anchorMs <= endMs
  );

  // Employee / Signature Statistics
  const empMap = new Map();
  const ensureEmp = (sig) => {
    if (!empMap.has(sig)) {
      empMap.set(sig, {
        signature: sig,
        sessionsCount: 0,
        normalSessionsCount: 0,
        forfaitSessionsCount: 0,
        sharedMinutes: 0,
        presenceMinutes: 0,
        totalAnnonces: 0,
        openAnnonces: 0,
        closeAnnonces: 0,
        otherAnnonces: 0
      });
    }
    return empMap.get(sig);
  };

  // 1. Count all announcements posted strictly within [startMs, endMs] (excluding external businesses & duplicates)
  for (const item of classified) {
    if (item.timestampMs < startMs || item.timestampMs > endMs) continue;
    if (item.eventType === 'EXTERNAL_OTHER' || item.eventType === 'DEDUP_IGNORED') continue;

    for (const sig of (item.signatures || ['Non signé'])) {
      const emp = ensureEmp(sig);
      emp.totalAnnonces += 1;
      if (item.eventType === 'OPEN') emp.openAnnonces += 1;
      else if (item.eventType === 'CLOSE') emp.closeAnnonces += 1;
      else emp.otherAnnonces += 1;
    }
  }

  // 2. Credit sessions & durations (Option B: credit all participants of the session, 50/50 split on sharedMinutes)
  for (const s of periodSessions) {
    const parts = s.participants && s.participants.length > 0 ? s.participants : ['Non signé'];
    const shareMin = s.durationMin / parts.length;

    for (const sig of parts) {
      const emp = ensureEmp(sig);
      emp.sessionsCount += 1;
      if (s.category === 'normal') emp.normalSessionsCount += 1;
      if (s.category === 'forfait') emp.forfaitSessionsCount += 1;
      emp.sharedMinutes += shareMin;
      emp.presenceMinutes += s.durationMin;
    }
  }

  const employeesList = Array.from(empMap.values()).sort((a, b) => {
    if (a.signature === 'Non signé') return 1;
    if (b.signature === 'Non signé') return -1;
    if (b.sessionsCount !== a.sessionsCount) return b.sessionsCount - a.sessionsCount;
    return b.totalAnnonces - a.totalAnnonces;
  });

  // Build Day-by-Day breakdown (calé sur la journée RP : 15h00 -> 14h59 le lendemain)
  const dailyMap = new Map();
  const startShifted = new Date(startMs - RP_SHIFT_MS);
  const endShifted = new Date(Math.max(startMs, endMs - 1000) - RP_SHIFT_MS);
  const dayCursor = new Date(startShifted.getFullYear(), startShifted.getMonth(), startShifted.getDate());
  const lastDay = new Date(endShifted.getFullYear(), endShifted.getMonth(), endShifted.getDate());

  while (dayCursor.getTime() <= lastDay.getTime()) {
    const key = toLocalDateKey(dayCursor.getTime(), 0);
    dailyMap.set(key, {
      dateKey: key,
      dateMs: dayCursor.getTime(),
      label: formatDateShort(dayCursor.getTime()),
      totalMin: 0,
      normalMin: 0,
      forfaitMin: 0,
      sessionCount: 0
    });
    dayCursor.setDate(dayCursor.getDate() + 1);
  }

  let totalMinutes = 0;
  let normalMinutes = 0;
  let forfaitMinutesTotal = 0;
  let normalCount = 0;
  let forfaitCount = 0;

  for (const s of periodSessions) {
    totalMinutes += s.durationMin;
    normalMinutes += s.normalMin;
    forfaitMinutesTotal += s.forfaitMin;

    if (s.category === 'normal') normalCount++;
    if (s.category === 'forfait') forfaitCount++;

    const dKey = toLocalDateKey(s.anchorMs, RP_SHIFT_MS);
    if (dailyMap.has(dKey)) {
      const dayEntry = dailyMap.get(dKey);
      dayEntry.totalMin += s.durationMin;
      dayEntry.normalMin += s.normalMin;
      dayEntry.forfaitMin += s.forfaitMin;
      dayEntry.sessionCount += 1;
    }
  }

  const daysArray = Array.from(dailyMap.values());
  const numDays = Math.max(1, daysArray.length);
  const activeDays = daysArray.filter((d) => d.sessionCount > 0).length;
  const totalSessions = periodSessions.length;

  return {
    startMs,
    endMs,
    numDays,
    activeDays,
    totalMinutes,
    normalMinutes,
    forfaitMinutesTotal,
    totalSessions,
    normalCount,
    forfaitCount,
    avgPerDayMin: totalMinutes / numDays,
    avgPerActiveDayMin: activeDays > 0 ? totalMinutes / activeDays : 0,
    avgPerSessionMin: totalSessions > 0 ? totalMinutes / totalSessions : 0,
    sessions: periodSessions,
    ignoredMessages,
    uncertainMessages: classified.filter((c) => c.uncertain && c.timestampMs >= startMs && c.timestampMs <= endMs),
    employees: employeesList,
    employeesMap: empMap,
    daily: daysArray
  };
}

// Render Comparison Badge
function renderDiffBadge(val1, val2, isDuration = true, invertColor = false) {
  const diff = val1 - val2;
  const pct = val2 > 0 ? Math.round(((val1 - val2) / val2) * 100) : (val1 > 0 ? 100 : 0);
  const sign = diff > 0 ? '+' : (diff < 0 ? '-' : '');
  const formattedDiff = isDuration
    ? `${sign}${formatDuration(Math.abs(diff))}`
    : `${sign}${Math.abs(Math.round(diff))}`;

  let cls = 'diff-neutral';
  if (Math.abs(diff) > 0.5) {
    const isGood = invertColor ? diff < 0 : diff > 0;
    cls = isGood ? 'diff-pos' : 'diff-neg';
  }

  const pctStr = val2 > 0 ? ` (${diff >= 0 ? '+' : ''}${pct}%)` : '';
  return `<span class="diff-badge ${cls}">${formattedDiff}${pctStr}</span>`;
}

// Render Employees / Signatures Table
function renderEmployeesTable() {
  const p1 = computedStats.p1;
  const p2 = computedStats.p2;
  if (!p1) return;

  const p1Name = els.p1Label.value || 'Période 1';
  const p2Name = els.p2Label.value || 'Période 2';
  const hasP2 = Boolean(p2);

  els.empTabP1.textContent = `${p1Name} (${p1.employees.length})`;
  if (hasP2) {
    els.empTabP2.textContent = `${p2Name} (${p2.employees.length})`;
    els.empTabP2.classList.remove('hidden');
    els.empTabCompare.classList.remove('hidden');
  } else {
    els.empTabP2.classList.add('hidden');
    els.empTabCompare.classList.add('hidden');
    activeEmployeeTab = 'p1';
  }

  els.empTabP1.classList.toggle('active', activeEmployeeTab === 'p1');
  els.empTabP2.classList.toggle('active', activeEmployeeTab === 'p2');
  els.empTabCompare.classList.toggle('active', activeEmployeeTab === 'compare');

  if (activeEmployeeTab === 'compare' && hasP2) {
    // Compare P1 vs P2 per signature
    const allSigs = new Set([
      ...p1.employees.map((e) => e.signature),
      ...p2.employees.map((e) => e.signature)
    ]);

    const combined = Array.from(allSigs).map((sig) => {
      const e1 = p1.employeesMap.get(sig) || {
        signature: sig, sessionsCount: 0, totalAnnonces: 0, openAnnonces: 0, closeAnnonces: 0, otherAnnonces: 0, sharedMinutes: 0, presenceMinutes: 0
      };
      const e2 = p2.employeesMap.get(sig) || {
        signature: sig, sessionsCount: 0, totalAnnonces: 0, openAnnonces: 0, closeAnnonces: 0, otherAnnonces: 0, sharedMinutes: 0, presenceMinutes: 0
      };
      return { sig, e1, e2 };
    }).sort((a, b) => {
      if (a.sig === 'Non signé') return 1;
      if (b.sig === 'Non signé') return -1;
      return (b.e1.sessionsCount + b.e2.sessionsCount) - (a.e1.sessionsCount + a.e2.sessionsCount);
    });

    els.employeesTableHead.innerHTML = `
      <tr>
        <th>Signature</th>
        <th>Services (${escapeHtml(p1Name)} vs ${escapeHtml(p2Name)})</th>
        <th>Total Annonces (${escapeHtml(p1Name)} vs ${escapeHtml(p2Name)})</th>
        <th>Ouvertures / Fermetures (${escapeHtml(p1Name)})</th>
        <th>Temps partagé (${escapeHtml(p1Name)} vs ${escapeHtml(p2Name)})</th>
      </tr>
    `;

    els.employeesTableBody.innerHTML = combined.map(({ sig, e1, e2 }) => `
      <tr>
        <td>${renderSigBadges([sig])}</td>
        <td>
          <strong>${e1.sessionsCount}</strong> vs ${e2.sessionsCount}
          ${renderDiffBadge(e1.sessionsCount, e2.sessionsCount, false)}
        </td>
        <td>
          <strong>${e1.totalAnnonces}</strong> vs ${e2.totalAnnonces}
          ${renderDiffBadge(e1.totalAnnonces, e2.totalAnnonces, false)}
        </td>
        <td>
          🟢 ${e1.openAnnonces} ouv. / 🔴 ${e1.closeAnnonces} ferm. / 📢 ${e1.otherAnnonces} autres
        </td>
        <td>
          <strong>${formatDuration(e1.sharedMinutes)}</strong> vs ${formatDuration(e2.sharedMinutes)}
          ${renderDiffBadge(e1.sharedMinutes, e2.sharedMinutes, true)}
        </td>
      </tr>
    `).join('');
    return;
  }

  // Single Period View (P1 or P2)
  const targetStats = (activeEmployeeTab === 'p2' && hasP2) ? p2 : p1;
  const maxSessions = Math.max(1, ...targetStats.employees.map((e) => e.sessionsCount));

  els.employeesTableHead.innerHTML = `
    <tr>
      <th>Signature</th>
      <th>Services (Participations)</th>
      <th>Total Annonces</th>
      <th>🟢 Ouvertures</th>
      <th>🔴 Fermetures</th>
      <th>📢 Autres annonces</th>
      <th>Temps partagé (50/50 si duo/relais)</th>
      <th>Temps de présence cumulé</th>
    </tr>
  `;

  if (targetStats.employees.length === 0) {
    els.employeesTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:20px;">Aucune annonce trouvée sur cette période.</td></tr>`;
    return;
  }

  els.employeesTableBody.innerHTML = targetStats.employees.map((emp) => {
    const barPct = Math.min(100, Math.round((emp.sessionsCount / maxSessions) * 100));
    return `
      <tr>
        <td>${renderSigBadges([emp.signature])}</td>
        <td>
          <div class="emp-bar-wrap">
            <strong>${emp.sessionsCount} service${emp.sessionsCount > 1 ? 's' : ''}</strong>
            <div class="emp-mini-bar"><div class="emp-mini-fill" style="width:${barPct}%"></div></div>
            <small style="color:var(--text-muted)">(${emp.normalSessionsCount} norm. / ${emp.forfaitSessionsCount} oubli)</small>
          </div>
        </td>
        <td><strong>${emp.totalAnnonces}</strong></td>
        <td><span style="color:#34d399;font-weight:600;">${emp.openAnnonces}</span></td>
        <td><span style="color:#fbbf24;font-weight:600;">${emp.closeAnnonces}</span></td>
        <td><span style="color:#94a3b8;">${emp.otherAnnonces}</span></td>
        <td><strong>${formatDuration(emp.sharedMinutes)}</strong></td>
        <td style="color:var(--text-muted)">${formatDuration(emp.presenceMinutes)}</td>
      </tr>
    `;
  }).join('');
}

// Render All UI Results
function renderResults() {
  const p1 = computedStats.p1;
  const p2 = computedStats.p2;
  if (!p1) return;

  els.resultsSection.classList.remove('hidden');

  const p1Name = els.p1Label.value || 'Période 1';
  const p2Name = els.p2Label.value || 'Période 2';
  const hasP2 = Boolean(p2);

  // KPI 1: Total Opening Time
  els.kpiTotalP1.textContent = formatDuration(p1.totalMinutes);
  els.kpiTotalCompare.innerHTML = hasP2
    ? `vs <strong>${formatDuration(p2.totalMinutes)}</strong> ${renderDiffBadge(p1.totalMinutes, p2.totalMinutes, true)}`
    : `Sur ${p1.numDays} jours (${p1.activeDays} jours d'ouverture)`;

  // KPI 2: Average per Day
  els.kpiAvgDayP1.textContent = `${formatDuration(p1.avgPerDayMin)} / j`;
  els.kpiAvgDayCompare.innerHTML = hasP2
    ? `vs <strong>${formatDuration(p2.avgPerDayMin)} / j</strong> ${renderDiffBadge(p1.avgPerDayMin, p2.avgPerDayMin, true)}`
    : `Moy. par session : <strong>${formatDuration(p1.avgPerSessionMin)}</strong>`;

  // KPI 3: Total Sessions
  els.kpiCountP1.textContent = `${p1.totalSessions} session${p1.totalSessions > 1 ? 's' : ''}`;
  els.kpiCountCompare.innerHTML = hasP2
    ? `vs <strong>${p2.totalSessions}</strong> ${renderDiffBadge(p1.totalSessions, p2.totalSessions, false)}`
    : `Dont ${p1.normalCount} normale(s) et ${p1.forfaitCount} forfait(s)`;

  // KPI 4: Forfaits (Oublis)
  els.kpiForfaitP1.textContent = `${p1.forfaitCount} oubli${p1.forfaitCount > 1 ? 's' : ''} (${formatDuration(p1.forfaitMinutesTotal)})`;
  els.kpiForfaitCompare.innerHTML = hasP2
    ? `vs <strong>${p2.forfaitCount} (${formatDuration(p2.forfaitMinutesTotal)})</strong> ${renderDiffBadge(p1.forfaitCount, p2.forfaitCount, false, true)}`
    : `Forfait appliqué : ${els.forfaitMinutes.value} min / oubli`;

  // Comparison Table
  els.thP1Name.textContent = `${p1Name} (${p1.numDays}j)`;
  els.thP2Name.textContent = hasP2 ? `${p2Name} (${p2.numDays}j)` : '—';
  els.thP2Name.style.display = hasP2 ? '' : 'none';
  els.thDiff.style.display = hasP2 ? '' : 'none';

  const rows = [
    {
      label: '⏱️ Temps total d\'ouverture (Retenu)',
      v1: `<strong>${formatDuration(p1.totalMinutes)}</strong>`,
      v2: hasP2 ? `<strong>${formatDuration(p2.totalMinutes)}</strong>` : '',
      diff: hasP2 ? renderDiffBadge(p1.totalMinutes, p2.totalMinutes, true) : ''
    },
    {
      label: '✅ Temps issu des sessions complètes',
      v1: `${formatDuration(p1.normalMinutes)} (${p1.normalCount} sessions)`,
      v2: hasP2 ? `${formatDuration(p2.normalMinutes)} (${p2.normalCount} sessions)` : '',
      diff: hasP2 ? renderDiffBadge(p1.normalMinutes, p2.normalMinutes, true) : ''
    },
    {
      label: `⚠️ Temps issu des forfaits d'oubli (${els.forfaitMinutes.value}m)`,
      v1: `${formatDuration(p1.forfaitMinutesTotal)} (${p1.forfaitCount} oublis)`,
      v2: hasP2 ? `${formatDuration(p2.forfaitMinutesTotal)} (${p2.forfaitCount} oublis)` : '',
      diff: hasP2 ? renderDiffBadge(p1.forfaitMinutesTotal, p2.forfaitMinutesTotal, true, true) : ''
    },
    {
      label: '📆 Moyenne d\'ouverture par jour (sur la période)',
      v1: formatDuration(p1.avgPerDayMin),
      v2: hasP2 ? formatDuration(p2.avgPerDayMin) : '',
      diff: hasP2 ? renderDiffBadge(p1.avgPerDayMin, p2.avgPerDayMin, true) : ''
    },
    {
      label: '⏳ Durée moyenne d\'une session d\'ouverture',
      v1: formatDuration(p1.avgPerSessionMin),
      v2: hasP2 ? formatDuration(p2.avgPerSessionMin) : '',
      diff: hasP2 ? renderDiffBadge(p1.avgPerSessionMin, p2.avgPerSessionMin, true) : ''
    },
    {
      label: '📅 Jours avec au moins 1 ouverture',
      v1: `${p1.activeDays} / ${p1.numDays} jours`,
      v2: hasP2 ? `${p2.activeDays} / ${p2.numDays} jours` : '',
      diff: hasP2 ? renderDiffBadge(p1.activeDays, p2.activeDays, false) : ''
    }
  ];

  els.comparisonTableBody.innerHTML = rows.map((r) => `
    <tr>
      <td>${r.label}</td>
      <td>${r.v1}</td>
      ${hasP2 ? `<td>${r.v2}</td><td>${r.diff}</td>` : ''}
    </tr>
  `).join('');

  // Render Companies Comparison (toutes entreprises) puis Employees Table
  renderCompaniesTable();
  renderEmployeesTable();

  // Render Daily Charts
  const maxDayMin = Math.max(
    60,
    ...p1.daily.map((d) => d.totalMin),
    ...(hasP2 ? p2.daily.map((d) => d.totalMin) : [0])
  );

  els.chartTitleP1.textContent = `${p1Name} — Total : ${formatDuration(p1.totalMinutes)}`;
  renderDailyBars(els.dailyBarsP1, p1.daily, maxDayMin);

  if (hasP2) {
    els.chartColP2.classList.remove('hidden');
    els.dailyChartsContainer.classList.remove('single-col');
    els.chartTitleP2.textContent = `${p2Name} — Total : ${formatDuration(p2.totalMinutes)}`;
    renderDailyBars(els.dailyBarsP2, p2.daily, maxDayMin);
    els.tabBtnP2.classList.remove('hidden');
  } else {
    els.chartColP2.classList.add('hidden');
    els.dailyChartsContainer.classList.add('single-col');
    els.tabBtnP2.classList.add('hidden');
    activePeriodTab = 'p1';
  }

  els.tabBtnP1.textContent = `Détail ${p1Name} (${p1.totalSessions})`;
  if (hasP2) {
    els.tabBtnP2.textContent = `Détail ${p2Name} (${p2.totalSessions})`;
  }

  renderSessionsTable();
}

function renderDailyBars(container, dailyList, maxMin) {
  container.innerHTML = dailyList.map((d) => {
    const normalPct = Math.min(100, (d.normalMin / maxMin) * 100);
    const forfaitPct = Math.min(100 - normalPct, (d.forfaitMin / maxMin) * 100);
    return `
      <div class="day-row">
        <span class="day-label">${d.label.slice(0, 9)}</span>
        <div class="day-bar-track" title="${d.label} : ${formatDuration(d.totalMin)} (${d.sessionCount} session(s))">
          <div class="day-bar-normal" style="width: ${normalPct.toFixed(1)}%"></div>
          <div class="day-bar-forfait" style="width: ${forfaitPct.toFixed(1)}%"></div>
        </div>
        <span class="day-val">${d.totalMin > 0 ? formatDuration(d.totalMin) : '—'}</span>
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderSessionsTable() {
  const stats = activePeriodTab === 'p2' && computedStats.p2 ? computedStats.p2 : computedStats.p1;
  if (!stats) return;

  els.tabBtnP1.classList.toggle('active', activePeriodTab === 'p1');
  els.tabBtnP2.classList.toggle('active', activePeriodTab === 'p2');

  const uncertainCount = stats.uncertainMessages.length;
  els.pillUncertain.textContent = `❓ À confirmer (${uncertainCount})`;

  if (activeSessionFilter === 'uncertain') {
    if (uncertainCount === 0) {
      els.sessionsTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px;">✅ Rien à confirmer sur cette période.</td></tr>`;
      return;
    }

    const typeLabels = { OPEN: '🟢 Ouverture', CLOSE: '🔴 Fermeture', WARN: '⏳ Préavis', OTHER: '⚪ Autre' };
    els.sessionsTableBody.innerHTML = stats.uncertainMessages.map((m) => {
      const guessed = m.source === 'none' ? 'Non classée' : `IA : ${typeLabels[m.eventType === 'DEDUP_IGNORED' ? m.originalType : m.eventType] || m.eventType} (${Math.round((m.aiConf || 0) * 100)}%)`;
      const btn = (type, label) => `<button type="button" class="btn btn-ghost btn-sm" data-override-id="${m.id}" data-override-type="${type}">${label}</button>`;
      return `
        <tr>
          <td>${formatDateShort(m.timestampMs)}</td>
          <td>${formatTimeHM(m.timestampMs)}</td>
          <td>—</td>
          <td>${renderSigBadges(m.signatures)}</td>
          <td>—</td>
          <td>
            <span class="badge-session badge-uncertain">${escapeHtml(guessed)}</span>
            <div class="confirm-actions" style="margin-top:6px;">${btn('OPEN', '🟢 Ouverture')}${btn('CLOSE', '🔴 Fermeture')}${btn('OTHER', '⚪ Autre')}</div>
          </td>
          <td><div class="embed-snippet" title="${escapeHtml(m.fullText)}">${escapeHtml(m.fullText)}</div></td>
        </tr>
      `;
    }).join('');
    return;
  }
  if (activeSessionFilter === 'ignored') {
    if (stats.ignoredMessages.length === 0) {
      els.sessionsTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px;">Aucun autre message ou doublon ignoré sur cette période.</td></tr>`;
      return;
    }

    els.sessionsTableBody.innerHTML = stats.ignoredMessages.map((m) => {
      let reason = '📢 Autre annonce';
      if (m.eventType === 'WARN') reason = '⏳ Préavis de fermeture (ignoré)';
      if (m.eventType === 'DEDUP_IGNORED') reason = `Doublon ignoré (< ${els.dedupMinutes.value} min)`;
      if (m.eventType === 'ORPHAN_CLOSE') reason = 'Fermeture sans ouverture préalable (ignorée)';

      return `
        <tr>
          <td>${formatDateShort(m.timestampMs)}</td>
          <td>${formatTimeHM(m.timestampMs)}</td>
          <td>—</td>
          <td>${renderSigBadges(m.signatures)}</td>
          <td>0h 00m</td>
          <td><span class="badge-session badge-ignored">${reason}</span></td>
          <td><div class="embed-snippet" title="${escapeHtml(m.fullText)}">${escapeHtml(m.fullText)}</div></td>
        </tr>
      `;
    }).join('');
    return;
  }

  let list = stats.sessions;
  if (activeSessionFilter === 'normal') {
    list = list.filter((s) => s.category === 'normal');
  } else if (activeSessionFilter === 'forfait') {
    list = list.filter((s) => s.category === 'forfait');
  }

  if (list.length === 0) {
    els.sessionsTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px;">Aucune session trouvée pour ce filtre sur cette période.</td></tr>`;
    return;
  }

  els.sessionsTableBody.innerHTML = list.map((s) => {
    const dateStr = formatDateShort(s.anchorMs);
    const openStr = s.openMsg ? formatTimeHM(s.openMsg.timestampMs) : '<em>Non annoncée</em>';
    let closeStr = '<em>Non annoncée</em>';
    if (s.closeMsg) {
      closeStr = formatTimeHM(s.closeMsg.timestampMs) + (s.crossesMidnight ? ' <small style="color:#7dd3fc">(+1j)</small>' : '');
    }

    // Format signatures (show relay if open signature != close signature)
    let sigHtml = '';
    const openSigs = s.openMsg ? s.openMsg.signatures : [];
    const closeSigs = s.closeMsg ? s.closeMsg.signatures : [];
    if (openSigs.length && closeSigs.length && openSigs.join(',') !== closeSigs.join(',')) {
      sigHtml = `${renderSigBadges(openSigs)} <span style="color:var(--text-muted)">→</span> ${renderSigBadges(closeSigs)}`;
    } else {
      sigHtml = renderSigBadges(s.participants);
    }

    const badgeCls = s.category === 'normal' ? 'badge-normal' : 'badge-forfait';
    const textPreview = [
      s.openMsg ? `[OUV] ${s.openMsg.fullText}` : '',
      s.closeMsg ? `[FERM] ${s.closeMsg.fullText}` : ''
    ].filter(Boolean).join('  |  ');

    const targetMsgId = (s.openMsg && s.openMsg.id) || (s.closeMsg && s.closeMsg.id) || '';
    const ignoreBtn = (!isPublicReadOnly && targetMsgId)
      ? `<button type="button" class="btn btn-ghost btn-sm" style="padding:2px 7px;font-size:11px;margin-left:6px;" title="Classer cette annonce comme simple info (pas une ouverture/fermeture)" data-override-id="${targetMsgId}" data-override-type="OTHER">✖ Ignorer</button>`
      : '';

    const forfaitBtn = (!isPublicReadOnly && s.openMsg && !s.confirmedForfait)
      ? `<button type="button" class="btn btn-ghost btn-sm" style="padding:2px 7px;font-size:11px;margin-left:6px;" title="Forcer ou confirmer le forfait (${els.forfaitMinutes.value} min) sur cette ouverture" data-force-forfait="${s.openMsg.id}">⏱️ Appliquer le forfait</button>`
      : '';

    const hasCandidates = !isPublicReadOnly && s.category === 'forfait' && !s.confirmedForfait && s.openMsg && Array.isArray(s.nextCandidates) && s.nextCandidates.length > 0;
    const inspectBtn = hasCandidates
      ? `<button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:11px;margin-left:6px;" data-toggle-candidates="cand_${s.openMsg.id}">🔎 Voir les ${s.nextCandidates.length} suivantes</button>`
      : '';

    let candidatesRowHtml = '';
    if (hasCandidates) {
      const itemsHtml = s.nextCandidates.map((cand, idx) => {
        const deltaMin = Math.round((cand.timestampMs - s.openMsg.timestampMs) / 60000);
        const deltaStr = `+${formatDuration(deltaMin)}`;
        return `
          <div class="candidate-item">
            <div class="candidate-meta">
              <span class="badge-session badge-ignored">#${idx + 1} (${deltaStr})</span>
              <strong>${formatDateShort(cand.timestampMs)} à ${formatTimeHM(cand.timestampMs)}</strong>
              ${renderSigBadges(cand.signatures)}
            </div>
            <div class="candidate-text">${escapeHtml(cand.fullText)}</div>
            <button type="button" class="btn btn-primary btn-sm" data-override-id="${cand.id}" data-override-type="CLOSE" data-pair-open-id="${s.openMsg.id}">
              🔴 Lier comme fermeture (${deltaStr})
            </button>
          </div>
        `;
      }).join('');

      candidatesRowHtml = `
        <tr id="cand_${s.openMsg.id}" class="candidates-row hidden">
          <td colspan="7">
            <div class="candidates-box">
              <div class="candidates-title">
                🔎 Les ${s.nextCandidates.length} annonces suivantes de cette entreprise après l'ouverture de ${openStr} (clique sur « Lier comme fermeture » si l'une d'elles ferme ce service, sinon laisse le forfait de ${els.forfaitMinutes.value}m) :
              </div>
              ${itemsHtml}
            </div>
          </td>
        </tr>
      `;
    }

    return `
      <tr>
        <td><strong>${dateStr}</strong></td>
        <td>${openStr}</td>
        <td>${closeStr}</td>
        <td>${sigHtml}</td>
        <td><strong>${formatDuration(s.durationMin)}</strong></td>
        <td><span class="badge-session ${badgeCls}">${s.statusLabel}</span>${inspectBtn}${forfaitBtn}${ignoreBtn}</td>
        <td><div class="embed-snippet" title="${escapeHtml(textPreview)}">${escapeHtml(textPreview)}</div></td>
      </tr>
      ${candidatesRowHtml}
    `;
  }).join('');
}

// Re-run local calculation whenever rules change (without re-fetching Discord!)
function recalculateIfLoaded() {
  if (!lastRawData.period1Messages || !lastRawData.p1Range) return;

  const rules = getFormConfig();
  computedStats.p1 = analyzePeriod(
    lastRawData.period1Messages,
    lastRawData.p1Range.startMs,
    lastRawData.p1Range.endMs,
    rules,
    selectedCompany
  );

  if (els.p2Enabled.checked && lastRawData.period2Messages && lastRawData.p2Range) {
    computedStats.p2 = analyzePeriod(
      lastRawData.period2Messages,
      lastRawData.p2Range.startMs,
      lastRawData.p2Range.endMs,
      rules,
      selectedCompany
    );
  } else {
    computedStats.p2 = null;
  }

  renderResults();
  showAiNotice();
}

function getFormConfig() {
  return {
    channelInput: els.channelInput.value.trim(),
    token: els.tokenInput.value.trim(),
    company: selectedCompany,
    allowedCompanies: els.allowedCompanies.value.trim() || DEFAULT_ALLOWED_COMPANIES,
    aiConfidencePct: Number(els.aiConfidencePct.value) || 90,
    geminiKey: els.geminiKey.value.trim(),
    geminiModel: els.geminiModel.value.trim() || 'gemini-3.5-flash-lite',
    openKeyword: els.openKeyword.value.trim(),
    closeKeyword: els.closeKeyword.value.trim(),
    forfaitMinutes: Number(els.forfaitMinutes.value) || 30,
    maxSessionHours: Number(els.maxSessionHours.value) || 8,
    dedupMinutes: Number(els.dedupMinutes.value) || 2,
    countOrphanCloseAsForfait: els.countOrphanCloseAsForfait.checked
  };
}

// Entreprises détectées (titre d'embed) dans les messages chargés
function getCompanies() {
  const rules = { openKeyword: els.openKeyword.value, closeKeyword: els.closeKeyword.value };
  const map = new Map();
  const seen = new Set();
  for (const list of [lastRawData.period1Messages, lastRawData.period2Messages]) {
    for (const m of (list || [])) {
      if (!m.companyKey || !isAllowedCompanyKey(m.companyKey) || seen.has(m.id)) continue;
      seen.add(m.id);
      if (!map.has(m.companyKey)) map.set(m.companyKey, { key: m.companyKey, name: m.companyName, messages: 0, opens: 0 });
      const c = map.get(m.companyKey);
      c.messages += 1;
      if (resolveMessageType(m, rules.openKeyword, rules.closeKeyword).type === 'OPEN') c.opens += 1;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.opens - a.opens || b.messages - a.messages);
}

function persistCompany() {
  if (isPublicReadOnly) return;
  fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(getFormConfig())
  }).catch(() => {});
}

function populateCompanySelect() {
  const companies = getCompanies();
  els.companySelect.innerHTML = companies
    .map((c) => `<option value="${escapeHtml(c.key)}">${escapeHtml(c.name)} (${c.messages} annonces)</option>`)
    .join('');
  if (!companies.some((c) => c.key === selectedCompany)) {
    selectedCompany = companies.length > 0 ? companies[0].key : '';
  }
  els.companySelect.value = selectedCompany;
  els.companyHint.textContent = companies.length > 0
    ? `${companies.length} entreprise(s) détectée(s) dans le salon. L'analyse détaillée porte sur celle-ci.`
    : 'Aucune annonce (embed) trouvée sur ces périodes.';
}

function countTotalUncertain() {
  const rules = getFormConfig();
  let total = 0;
  const listAndRanges = [
    [lastRawData.period1Messages, lastRawData.p1Range],
    ...(els.p2Enabled.checked ? [[lastRawData.period2Messages, lastRawData.p2Range]] : [])
  ];
  for (const [msgs, range] of listAndRanges) {
    if (!msgs || !range) continue;
    for (const m of msgs) {
      if (!m.companyKey || !isAllowedCompanyKey(m.companyKey)) continue;
      if (m.timestampMs < range.startMs || m.timestampMs > range.endMs) continue;
      if (resolveMessageType(m, rules.openKeyword, rules.closeKeyword).uncertain) total++;
    }
  }
  return total;
}

function showAiNotice(s = lastAiStats) {
  lastAiStats = s;
  if (!s || !s.toClassify) {
    els.aiNotice.classList.add('hidden');
    return;
  }
  const uncertainTotal = countTotalUncertain();
  let text;
  if (s.noKey) {
    text = uncertainTotal > 0
      ? `⚠️ ${s.toClassify} annonce(s) ne contiennent aucune phrase connue et n'ont pas pu être classées : aucune clé Gemini configurée. ${uncertainTotal} annonce(s) sont dans « ❓ À confirmer ».`
      : `✅ ${s.toClassify} annonce(s) vérifiées (0 cas douteux restant à confirmer).`;
  } else if (s.error) {
    text = `⚠️ Classement IA incomplet : ${s.error} (${s.classified} classées, ${s.unclassified} restantes). Relance l'analyse pour continuer ; ce qui est déjà classé est conservé.`;
  } else if (uncertainTotal > 0) {
    text = `🤖 ${s.classified} nouvelle(s) annonce(s) classée(s) par l'IA (Gemini). Il reste ${uncertainTotal} cas douteux dans « ❓ À confirmer ».`;
  } else {
    text = `🤖 ${s.classified} nouvelle(s) annonce(s) classée(s) par l'IA (Gemini) — ✅ 0 cas douteux à confirmer.`;
  }
  els.aiNotice.textContent = text;
  els.aiNotice.classList.remove('hidden');
}

// Comparatif entre toutes les entreprises sur la période choisie
function renderCompaniesTable() {
  const hasP2 = Boolean(computedStats.p2);
  els.compTabP2.classList.toggle('hidden', !hasP2);
  if (!hasP2) activeCompTab = 'p1';
  els.compTabP1.classList.toggle('active', activeCompTab === 'p1');
  els.compTabP2.classList.toggle('active', activeCompTab === 'p2');
  els.compTabP1.textContent = els.p1Label.value || 'Période 1';
  els.compTabP2.textContent = els.p2Label.value || 'Période 2';

  const isP2 = activeCompTab === 'p2' && hasP2;
  const msgs = (isP2 ? lastRawData.period2Messages : lastRawData.period1Messages) || [];
  const range = isP2 ? lastRawData.p2Range : lastRawData.p1Range;
  if (!range) return;
  const rules = getFormConfig();

  const names = new Map();
  for (const m of msgs) {
    if (m.companyKey && isAllowedCompanyKey(m.companyKey) && !names.has(m.companyKey)) {
      names.set(m.companyKey, m.companyName);
    }
  }

  const rows = Array.from(names.entries())
    .map(([key, name]) => ({ key, name, s: analyzePeriod(msgs, range.startMs, range.endMs, rules, key) }))
    .filter((r) => r.s.employees.length > 0 || r.s.totalSessions > 0)
    .sort((a, b) => b.s.totalMinutes - a.s.totalMinutes || a.name.localeCompare(b.name));

  els.companiesTableHead.innerHTML = `
    <tr>
      <th>Entreprise</th>
      <th>Temps total d'ouverture</th>
      <th>Sessions</th>
      <th>Oublis (forfait)</th>
      <th>Moyenne / jour</th>
      <th>Durée moy. / session</th>
      <th>Employés les plus actifs</th>
      <th>À confirmer</th>
    </tr>
  `;

  if (rows.length === 0) {
    els.companiesTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:20px;">Aucune annonce sur cette période.</td></tr>`;
    return;
  }

  els.companiesTableBody.innerHTML = rows.map(({ key, name, s }) => {
    const top = s.employees
      .filter((e) => e.signature !== 'Non signé')
      .slice(0, 3)
      .map((e) => `<span class="sig-badge">${escapeHtml(e.signature)}</span> ${e.sessionsCount} svc / ${e.totalAnnonces} ann.`)
      .join(' &nbsp; ') || '<span style="color:var(--text-muted)">—</span>';
    return `
      <tr data-company="${escapeHtml(key)}" class="${key === selectedCompany ? 'company-current' : ''}" style="cursor:pointer" title="Cliquer pour analyser cette entreprise en détail">
        <td class="company-name-cell">${escapeHtml(name)}${key === selectedCompany ? ' <span class="badge-session badge-ai">analysée</span>' : ''}</td>
        <td><strong>${formatDuration(s.totalMinutes)}</strong></td>
        <td>${s.totalSessions}</td>
        <td>${s.forfaitCount > 0 ? `<span class="badge-session badge-forfait">${s.forfaitCount} (${formatDuration(s.forfaitMinutesTotal)})</span>` : '0'}</td>
        <td>${formatDuration(s.avgPerDayMin)}</td>
        <td>${formatDuration(s.avgPerSessionMin)}</td>
        <td>${top}</td>
        <td>${s.uncertainMessages.length > 0 ? `<span class="badge-session badge-uncertain">❓ ${s.uncertainMessages.length}</span>` : '—'}</td>
      </tr>
    `;
  }).join('');
}

function updateChannelStatusUI(conf) {
  if (conf.channelId && conf.token) {
    els.channelStatusPill.textContent = conf.channelName ? `#${conf.channelName}` : `Salon ${conf.channelId}`;
    els.channelStatusPill.className = 'status-pill status-ok';
    els.resolvedChannelHint.textContent = `Salon configuré : ${conf.channelName ? '#' + conf.channelName : conf.channelId} (Serveur : ${conf.guildId || 'Auto'})`;
  } else {
    els.channelStatusPill.textContent = 'À configurer';
    els.channelStatusPill.className = 'status-pill status-warn';
  }
}

// Presets for Dates (calés sur le cycle RP : début à 15h00, fin à 14h59 le lendemain du dernier jour RP)
function clampDateToPublicBounds(dateObj) {
  if (!publicBounds) return dateObj;
  const ms = dateObj.getTime();
  const minD = new Date(publicBounds.minDateStr + 'T00:00:00');
  const maxD = new Date(publicBounds.maxDateStr + 'T00:00:00');
  if (ms < minD.getTime()) return minD;
  if (ms > maxD.getTime()) return maxD;
  return dateObj;
}

function applyDatePreset(preset) {
  // En mode public en ligne, on cale "aujourd'hui" sur la fin des données publiées pour ne jamais dépasser la plage
  const now = publicBounds ? new Date(publicBounds.maxMs) : new Date();
  // Si on est avant 15h00, la journée RP en cours a commencé hier à 15h00
  const rpToday = new Date(now.getTime() - RP_SHIFT_MS);
  const today = new Date(rpToday.getFullYear(), rpToday.getMonth(), rpToday.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (els.p1StartTime) els.p1StartTime.value = '15:00';
  if (els.p1EndTime) els.p1EndTime.value = '14:59';
  if (els.p2StartTime) els.p2StartTime.value = '15:00';
  if (els.p2EndTime) els.p2EndTime.value = '14:59';

  if (preset === '7d') {
    const p1End = clampDateToPublicBounds(new Date(tomorrow));
    const p1Start = new Date(today);
    p1Start.setDate(p1Start.getDate() - 6);

    const p2End = new Date(p1Start);
    const p2Start = new Date(p2End);
    p2Start.setDate(p2Start.getDate() - 7);

    els.p1Label.value = '7 derniers jours';
    els.p2Label.value = '7 jours précédents';
    els.p1Start.value = formatDateInput(clampDateToPublicBounds(p1Start));
    els.p1End.value = formatDateInput(p1End);
    els.p2Start.value = formatDateInput(clampDateToPublicBounds(p2Start));
    els.p2End.value = formatDateInput(clampDateToPublicBounds(p2End));
  } else if (preset === '14d') {
    const p1End = clampDateToPublicBounds(new Date(tomorrow));
    const p1Start = new Date(today);
    p1Start.setDate(p1Start.getDate() - 13);

    const p2End = new Date(p1Start);
    const p2Start = new Date(p2End);
    p2Start.setDate(p2Start.getDate() - 14);

    els.p1Label.value = '2 dernières semaines';
    els.p2Label.value = '2 semaines précédentes';
    els.p1Start.value = formatDateInput(clampDateToPublicBounds(p1Start));
    els.p1End.value = formatDateInput(p1End);
    els.p2Start.value = formatDateInput(clampDateToPublicBounds(p2Start));
    els.p2End.value = formatDateInput(clampDateToPublicBounds(p2End));
  } else if (preset === 'this_vs_last_week') {
    const dayOfWeek = (today.getDay() + 6) % 7; // Monday = 0
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - dayOfWeek);

    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    const lastWeekEnd = new Date(thisMonday); // Lundi 14h59 clôt la nuit du Dimanche RP

    els.p1Label.value = 'Cette semaine';
    els.p2Label.value = 'Semaine dernière';
    els.p1Start.value = formatDateInput(clampDateToPublicBounds(thisMonday));
    els.p1End.value = formatDateInput(clampDateToPublicBounds(tomorrow));
    els.p2Start.value = formatDateInput(clampDateToPublicBounds(lastMonday));
    els.p2End.value = formatDateInput(clampDateToPublicBounds(lastWeekEnd));
  } else if (preset === 'this_vs_last_month') {
    const firstThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endLastMonthRp = new Date(firstThisMonth); // 1er du mois à 14h59 clôt le dernier jour RP du mois précédent

    els.p1Label.value = 'Mois en cours';
    els.p2Label.value = 'Mois dernier';
    els.p1Start.value = formatDateInput(clampDateToPublicBounds(firstThisMonth));
    els.p1End.value = formatDateInput(clampDateToPublicBounds(tomorrow));
    els.p2Start.value = formatDateInput(clampDateToPublicBounds(firstLastMonth));
    els.p2End.value = formatDateInput(clampDateToPublicBounds(endLastMonthRp));
  }
}

// Export CSV
function exportToCsv() {
  if (!computedStats.p1) return;
  const lines = [
    '=== SYNTHESE PAR EMPLOYE (SIGNATURES) ===',
    ['Periode', 'Signature', 'Services_Participes', 'Total_Annonces', 'Ouvertures', 'Fermetures', 'Autres_Annonces', 'Temps_Partage_Formate', 'Temps_Presence_Formate'].join(';')
  ];

  const addEmpToCsv = (label, stats) => {
    if (!stats) return;
    for (const e of stats.employees) {
      lines.push([
        label,
        e.signature,
        e.sessionsCount,
        e.totalAnnonces,
        e.openAnnonces,
        e.closeAnnonces,
        e.otherAnnonces,
        formatDuration(e.sharedMinutes),
        formatDuration(e.presenceMinutes)
      ].join(';'));
    }
  };

  addEmpToCsv(els.p1Label.value || 'Periode 1', computedStats.p1);
  if (computedStats.p2) {
    addEmpToCsv(els.p2Label.value || 'Periode 2', computedStats.p2);
  }

  lines.push('');
  lines.push('=== DETAIL DES SESSIONS ===');
  lines.push(['Periode', 'Date', 'Heure_Ouverture', 'Heure_Fermeture', 'Signatures', 'Duree_Minutes', 'Duree_Formatee', 'Statut', 'Message_Embed'].join(';'));

  const addSessionsToCsv = (label, stats) => {
    if (!stats) return;
    for (const s of stats.sessions) {
      const dateStr = formatDateShort(s.anchorMs);
      const openStr = s.openMsg ? formatTimeHM(s.openMsg.timestampMs) : 'Non annoncee';
      const closeStr = s.closeMsg ? formatTimeHM(s.closeMsg.timestampMs) : 'Non annoncee';
      const sigStr = (s.participants || []).join(' & ');
      const durMin = Math.round(s.durationMin);
      const durFmt = formatDuration(s.durationMin);
      const text = ((s.openMsg?.fullText || '') + ' / ' + (s.closeMsg?.fullText || '')).replace(/[\r\n;]+/g, ' ').trim();
      lines.push([label, dateStr, openStr, closeStr, sigStr, durMin, durFmt, s.statusLabel, `"${text.replace(/"/g, '""')}"`].join(';'));
    }
  };

  addSessionsToCsv(els.p1Label.value || 'Periode 1', computedStats.p1);
  if (computedStats.p2) {
    addSessionsToCsv(els.p2Label.value || 'Periode 2', computedStats.p2);
  }

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Ombrelune_Stats_${els.p1Start.value}_au_${els.p1End.value}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function applyRangesFromInputsAndRecalculate() {
  if (!lastRawData.period1Messages || !els.p1Start.value || !els.p1End.value) return;

  if (publicBounds) {
    [els.p1Start, els.p1End, els.p2Start, els.p2End].forEach((inp) => {
      if (!inp || !inp.value) return;
      if (inp.value < publicBounds.minDateStr) inp.value = publicBounds.minDateStr;
      if (inp.value > publicBounds.maxDateStr) inp.value = publicBounds.maxDateStr;
    });
  }

  const newP1Start = dateInputToStartMs(els.p1Start.value, els.p1StartTime && els.p1StartTime.value);
  const newP1End = dateInputToEndMs(els.p1End.value, els.p1EndTime && els.p1EndTime.value);
  if (isPublicReadOnly || (lastRawData.p1FetchedRange && newP1Start >= lastRawData.p1FetchedRange.startMs && newP1End <= lastRawData.p1FetchedRange.endMs)) {
    lastRawData.p1Range = { startMs: newP1Start, endMs: newP1End };
    if (els.p2Enabled.checked && els.p2Start.value && els.p2End.value) {
      const newP2Start = dateInputToStartMs(els.p2Start.value, els.p2StartTime && els.p2StartTime.value);
      const newP2End = dateInputToEndMs(els.p2End.value, els.p2EndTime && els.p2EndTime.value);
      if (isPublicReadOnly || (lastRawData.p2FetchedRange && newP2Start >= lastRawData.p2FetchedRange.startMs && newP2End <= lastRawData.p2FetchedRange.endMs)) {
        lastRawData.p2Range = { startMs: newP2Start, endMs: newP2End };
      }
    }
    recalculateIfLoaded();
  }
}

function renderPublishPanel(data) {
  if (!els.publishStatusBox) return;
  els.publishStatusBox.classList.remove('hidden');

  const minStr = formatDateShort(data.minTimestampMs);
  const maxStr = formatDateShort(data.maxTimestampMs);
  const repoVal = escapeHtml(data.githubRepoUrl || (currentConfig && currentConfig.githubRepoUrl) || '');

  let statusHtml = `<div style="color:#34d399;font-weight:600;">✅ Version publique générée dans <code>docs/</code> (${data.totalMessages} annonces consolidées, du <strong>${minStr}</strong> au <strong>${maxStr}</strong>).</div>`;
  if (data.pushed && data.pagesUrl) {
    statusHtml += `<div style="margin-top:6px;">🚀 <strong>Poussé sur GitHub avec succès !</strong> Ton lien public : <a href="${escapeHtml(data.pagesUrl)}" target="_blank" style="color:#c4b5fd;font-weight:700;text-decoration:underline;">${escapeHtml(data.pagesUrl)}</a> <small style="color:var(--text-muted)">(GitHub Pages met ~30 secondes à rafraîchir)</small></div>`;
  } else if (data.error) {
    statusHtml += `<div style="margin-top:6px;color:#f87171;">⚠️ Erreur Git : ${escapeHtml(data.error)}</div>`;
  } else {
    statusHtml += `<div style="margin-top:6px;color:var(--text-muted);">💡 Pour mettre en ligne en 1 clic sur GitHub Pages : crée un dépôt vide sur <a href="https://github.com/new" target="_blank" style="color:#c4b5fd;">github.com/new</a> (ex: <code>ombrelune-stats</code>), colle son URL ci-dessous et clique sur <strong>Publier sur GitHub</strong> (puis active <em>Settings → Pages → Branch: main</em> une seule fois sur GitHub).</div>`;
  }

  els.publishStatusBox.innerHTML = `
    <div class="card-header" style="margin-bottom:8px;">
      <h2>🌐 Publication en ligne (GitHub Pages — 0 secret exporté)</h2>
      <button type="button" class="btn btn-ghost btn-sm" id="btnClosePublishBox">✖ Fermer</button>
    </div>
    ${statusHtml}
    <div class="publish-row">
      <input type="text" id="githubRepoInput" placeholder="URL du dépôt GitHub (ex: https://github.com/papydovah/ombrelune-stats.git)" value="${repoVal}" />
      <button type="button" class="btn btn-primary" id="btnPushGithub">🚀 Publier sur GitHub</button>
    </div>
  `;

  const closeBtn = document.getElementById('btnClosePublishBox');
  if (closeBtn) closeBtn.addEventListener('click', () => els.publishStatusBox.classList.add('hidden'));

  const pushBtn = document.getElementById('btnPushGithub');
  const repoInp = document.getElementById('githubRepoInput');
  if (pushBtn && repoInp) {
    pushBtn.addEventListener('click', async () => {
      pushBtn.disabled = true;
      pushBtn.textContent = '⏳ Envoi vers GitHub...';
      try {
        const res = await fetch('/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ githubRepoUrl: repoInp.value.trim() })
        });
        const out = await res.json();
        if (currentConfig) currentConfig.githubRepoUrl = out.githubRepoUrl;
        renderPublishPanel(out);
      } catch (e) {
        alert('Erreur publication : ' + e.message);
        pushBtn.disabled = false;
        pushBtn.textContent = '🚀 Publier sur GitHub';
      }
    });
  }
}

// Initialize & Event Listeners
async function init() {
  // 1. Vérifier si on est sur la version publique en ligne (présence de ./published-data.json)
  try {
    const pubRes = await fetch('./published-data.json', { cache: 'no-store' });
    if (pubRes.ok) {
      const snap = await pubRes.json();
      if (snap && Array.isArray(snap.messages)) {
        isPublicReadOnly = true;
        const r = snap.rules || {};
        els.allowedCompanies.value = r.allowedCompanies || DEFAULT_ALLOWED_COMPANIES;
        els.aiConfidencePct.value = r.aiConfidencePct ?? 90;
        selectedCompany = r.company || 'ombrelune';
        els.openKeyword.value = r.openKeyword || 'Ombrelune ouvre ses porte';
        els.closeKeyword.value = r.closeKeyword || 'Ombrelune se referment';
        els.forfaitMinutes.value = r.forfaitMinutes ?? 30;
        els.maxSessionHours.value = r.maxSessionHours ?? 8;
        els.dedupMinutes.value = r.dedupMinutes ?? 2;
        els.countOrphanCloseAsForfait.checked = Boolean(r.countOrphanCloseAsForfait);

        // Masquer les contrôles d'administration locale
        if (els.adminHeaderActions) els.adminHeaderActions.classList.add('hidden');
        if (els.configPanel) els.configPanel.classList.add('hidden');
        if (els.localCacheOptions) els.localCacheOptions.classList.add('hidden');
        if (els.pillUncertain) els.pillUncertain.classList.add('hidden');
        if (els.btnAnalyze) els.btnAnalyze.textContent = '🔄 Actualiser les périodes';

        const minDateStr = toLocalDateKey(snap.minTimestampMs - RP_SHIFT_MS);
        const maxDateStr = toLocalDateKey(snap.maxTimestampMs + (24 * 3600 * 1000 - RP_SHIFT_MS));
        publicBounds = {
          minMs: snap.minTimestampMs,
          maxMs: snap.maxTimestampMs,
          minDateStr,
          maxDateStr,
          publishedAt: snap.publishedAt
        };

        // Verrouiller les calendriers sur la plage disponible uniquement
        [els.p1Start, els.p1End, els.p2Start, els.p2End].forEach((inp) => {
          if (!inp) return;
          inp.min = minDateStr;
          inp.max = maxDateStr;
        });

        if (els.publicRangeBanner) {
          const pubDate = snap.publishedAt ? new Date(snap.publishedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '';
          els.publicRangeBanner.innerHTML = `🌐 <strong>Mode consultation en ligne</strong> — Données disponibles du <strong>${formatDateShort(snap.minTimestampMs)}</strong> au <strong>${formatDateShort(snap.maxTimestampMs)}</strong> (${snap.messages.length} annonces consolidées${pubDate ? `, mis à jour le ${pubDate}` : ''}). Sélectionne librement tes dates et heures dans cette plage.`;
          els.publicRangeBanner.classList.remove('hidden');
        }

        applyDatePreset('14d');

        const p1StartMs = dateInputToStartMs(els.p1Start.value, els.p1StartTime.value);
        const p1EndMs = dateInputToEndMs(els.p1End.value, els.p1EndTime.value);
        const p2StartMs = dateInputToStartMs(els.p2Start.value, els.p2StartTime.value);
        const p2EndMs = dateInputToEndMs(els.p2End.value, els.p2EndTime.value);

        lastRawData = {
          period1Messages: snap.messages,
          period2Messages: snap.messages,
          p1Range: { startMs: p1StartMs, endMs: p1EndMs },
          p2Range: { startMs: p2StartMs, endMs: p2EndMs },
          p1FetchedRange: { startMs: snap.minTimestampMs - 86400000, endMs: snap.maxTimestampMs + 86400000 },
          p2FetchedRange: { startMs: snap.minTimestampMs - 86400000, endMs: snap.maxTimestampMs + 86400000 }
        };

        populateCompanySelect();
        recalculateIfLoaded();
      }
    }
  } catch (_) {}

  if (!isPublicReadOnly) {
    // Default 14d preset
    applyDatePreset('14d');

    // Load saved config
    try {
      const res = await fetch('/api/config');
      const conf = await res.json();
      currentConfig = conf;

      els.channelInput.value = conf.channelInput || (conf.guildId && conf.channelId ? `https://discord.com/channels/${conf.guildId}/${conf.channelId}` : conf.channelId || '');
      els.tokenInput.value = conf.token || '';
      els.geminiKey.value = conf.geminiKey || '';
      els.geminiModel.value = (!conf.geminiModel || conf.geminiModel === 'gemini-2.5-flash-lite') ? 'gemini-3.5-flash-lite' : conf.geminiModel;
      els.allowedCompanies.value = conf.allowedCompanies || DEFAULT_ALLOWED_COMPANIES;
      els.aiConfidencePct.value = conf.aiConfidencePct ?? 90;
      selectedCompany = conf.company || '';
      els.openKeyword.value = conf.openKeyword || 'Ombrelune ouvre ses porte';
      els.closeKeyword.value = conf.closeKeyword || 'Ombrelune se referment';
      els.forfaitMinutes.value = conf.forfaitMinutes ?? 30;
      els.maxSessionHours.value = conf.maxSessionHours ?? 8;
      els.dedupMinutes.value = conf.dedupMinutes ?? 2;
      els.countOrphanCloseAsForfait.checked = Boolean(conf.countOrphanCloseAsForfait);

      updateChannelStatusUI(conf);

      // Collapse config panel if already configured
      if (conf.token && conf.channelId) {
        els.configPanel.classList.add('hidden');
      }
    } catch (e) {
      console.error('Impossible de charger la config:', e);
    }
  }

  // Event listeners
  els.btnToggleConfig.addEventListener('click', () => {
    els.configPanel.classList.toggle('hidden');
  });

  els.btnToggleHelp.addEventListener('click', () => {
    els.helpBox.classList.toggle('hidden');
  });

  els.btnToggleToken.addEventListener('click', () => {
    els.tokenInput.type = els.tokenInput.type === 'password' ? 'text' : 'password';
  });

  els.btnToggleGeminiKey.addEventListener('click', () => {
    els.geminiKey.type = els.geminiKey.type === 'password' ? 'text' : 'password';
  });

  // Test de la clé Gemini sur 3 annonces d'exemple
  els.btnTestGemini.addEventListener('click', async () => {
    els.btnTestGemini.disabled = true;
    els.geminiTestResult.textContent = '⏳ Test en cours...';
    try {
      const res = await fetch('/api/test-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiKey: els.geminiKey.value.trim(), geminiModel: els.geminiModel.value.trim() })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Erreur Gemini');
      const ok = data.results.filter((r) => r.expected === r.got).length;
      els.geminiTestResult.textContent = `${ok === data.results.length ? '✅' : '⚠️'} ${ok}/${data.results.length} exemples bien classés (${data.results.map((r) => `${r.expected}→${r.got}`).join(', ')})`;
    } catch (e) {
      els.geminiTestResult.textContent = `❌ ${e.message}`;
    } finally {
      els.btnTestGemini.disabled = false;
    }
  });

  // Changement d'entreprise analysée : recalcul instantané, sans relire Discord
  els.companySelect.addEventListener('change', () => {
    selectedCompany = els.companySelect.value;
    persistCompany();
    recalculateIfLoaded();
  });

  document.querySelectorAll('[data-comp-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCompTab = btn.getAttribute('data-comp-tab');
      renderCompaniesTable();
    });
  });

  // Clic sur une ligne du comparatif : analyser cette entreprise en détail
  els.companiesTableBody.addEventListener('click', (ev) => {
    const row = ev.target.closest('[data-company]');
    if (!row) return;
    selectedCompany = row.getAttribute('data-company');
    els.companySelect.value = selectedCompany;
    persistCompany();
    recalculateIfLoaded();
  });

  // Confirmation manuelle d'une annonce ou liaison manuelle d'une fermeture (mémorisée côté serveur)
  els.sessionsTableBody.addEventListener('click', async (ev) => {
    const toggleBtn = ev.target.closest('[data-toggle-candidates]');
    if (toggleBtn) {
      const rowId = toggleBtn.getAttribute('data-toggle-candidates');
      const targetRow = document.getElementById(rowId);
      if (targetRow) targetRow.classList.toggle('hidden');
      return;
    }

    const forfaitBtn = ev.target.closest('[data-force-forfait]');
    if (forfaitBtn) {
      const openId = forfaitBtn.getAttribute('data-force-forfait');
      forfaitBtn.disabled = true;
      try {
        const res = await fetch('/api/override', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forceForfaitOpenId: openId })
        });
        if (!res.ok) throw new Error('Enregistrement impossible');
        for (const list of [lastRawData.period1Messages, lastRawData.period2Messages]) {
          for (const m of (list || [])) {
            if (m.id === openId) {
              m.forcedForfait = true;
              delete m.pairedCloseId;
            }
          }
        }
        recalculateIfLoaded();
      } catch (e) {
        forfaitBtn.disabled = false;
        alert('Erreur : ' + e.message);
      }
      return;
    }

    const btn = ev.target.closest('[data-override-id]');
    if (!btn) return;
    const id = btn.getAttribute('data-override-id');
    const type = btn.getAttribute('data-override-type');
    const pairWithOpenId = btn.getAttribute('data-pair-open-id') || '';
    btn.disabled = true;
    try {
      const res = await fetch('/api/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type, pairWithOpenId })
      });
      if (!res.ok) throw new Error('Enregistrement impossible');
      for (const list of [lastRawData.period1Messages, lastRawData.period2Messages]) {
        for (const m of (list || [])) {
          if (m.id === id) m.userType = type;
          if (pairWithOpenId && m.id === pairWithOpenId) m.pairedCloseId = id;
        }
      }
      recalculateIfLoaded();
    } catch (e) {
      btn.disabled = false;
      alert('Erreur : ' + e.message);
    }
  });

  els.p2Enabled.addEventListener('change', () => {
    els.period2Container.classList.toggle('disabled-period', !els.p2Enabled.checked);
    recalculateIfLoaded();
  });

  // Live recalculation when parameters change
  [els.openKeyword, els.closeKeyword, els.forfaitMinutes, els.maxSessionHours, els.dedupMinutes, els.aiConfidencePct, els.countOrphanCloseAsForfait].forEach((input) => {
    input.addEventListener('change', recalculateIfLoaded);
  });

  // Si on ajuste les heures ou les dates à l'intérieur d'une période déjà chargée, recalcul instantané en mémoire
  [els.p1Start, els.p1StartTime, els.p1End, els.p1EndTime, els.p2Start, els.p2StartTime, els.p2End, els.p2EndTime].forEach((input) => {
    if (!input) return;
    input.addEventListener('change', applyRangesFromInputsAndRecalculate);
  });

  if (els.btnPublishOnline) {
    els.btnPublishOnline.addEventListener('click', async () => {
      els.btnPublishOnline.disabled = true;
      const prevText = els.btnPublishOnline.textContent;
      els.btnPublishOnline.textContent = '⏳ Publication...';
      try {
        const res = await fetch('/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Erreur lors de la publication');
        renderPublishPanel(data);
      } catch (e) {
        alert('Erreur publication : ' + e.message);
      } finally {
        els.btnPublishOnline.disabled = false;
        els.btnPublishOnline.textContent = prevText;
      }
    });
  }

  els.allowedCompanies.addEventListener('change', () => {
    populateCompanySelect();
    recalculateIfLoaded();
  });

  // Save Config
  els.btnSaveConfig.addEventListener('click', async () => {
    els.btnSaveConfig.disabled = true;
    els.btnSaveConfig.textContent = '⏳ Enregistrement...';
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getFormConfig())
      });
      const saved = await res.json();
      currentConfig = saved;
      updateChannelStatusUI(saved);
      els.btnSaveConfig.textContent = '✅ Enregistré !';
      setTimeout(() => { els.btnSaveConfig.textContent = '💾 Enregistrer la configuration'; }, 2000);
    } catch (e) {
      alert('Erreur lors de la sauvegarde: ' + e.message);
      els.btnSaveConfig.textContent = '💾 Enregistrer la configuration';
    } finally {
      els.btnSaveConfig.disabled = false;
    }
  });

  // Test Connection & Preview
  els.btnTestConnection.addEventListener('click', async () => {
    els.btnTestConnection.disabled = true;
    els.btnTestConnection.textContent = '⏳ Connexion à Discord...';
    els.testPreviewBox.classList.remove('hidden');
    els.testPreviewBox.innerHTML = 'Vérification du salon et lecture des derniers embeds Ombrelune...';

    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getFormConfig())
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Erreur de connexion');
      }

      currentConfig = data.config;
      updateChannelStatusUI(data.config);

      const openKw = els.openKeyword.value;
      const closeKw = els.closeKeyword.value;

      if (!data.preview || data.preview.length === 0) {
        els.testPreviewBox.innerHTML = `
          <div style="color:#34d399;font-weight:600;margin-bottom:6px;">✅ Connexion réussie au salon #${escapeHtml(data.config.channelName)} !</div>
          <div style="color:var(--text-muted)">Aucune annonce (message avec embed) trouvée parmi les 100 derniers messages du salon.</div>
        `;
      } else {
        const itemsHtml = data.preview.map((m) => {
          const type = m.ruleType || 'OTHER';
          const sigs = extractSignatures(m);
          let badge = `<span class="badge-session badge-ignored">Phrase inconnue : classée par l'IA à l'analyse</span>`;
          if (type === 'OPEN') badge = `<span class="badge-session badge-normal">🟢 OUVERTURE détectée</span>`;
          if (type === 'CLOSE') badge = `<span class="badge-session badge-forfait">🔴 FERMETURE détectée</span>`;

          const ts = new Date(m.timestamp).getTime();
          return `
            <div class="preview-item">
              <div>
                <strong>${formatDateShort(ts)} à ${formatTimeHM(ts)}</strong> <span class="sig-badge sig-unsigned">${escapeHtml(m.companyName)}</span> ${renderSigBadges(sigs)} —
                <span style="color:var(--text-muted)">${escapeHtml(m.fullText.slice(0, 130))}</span>
              </div>
              ${badge}
            </div>
          `;
        }).join('');

        els.testPreviewBox.innerHTML = `
          <div style="color:#34d399;font-weight:600;margin-bottom:8px;">
            ✅ Connexion réussie au salon #${escapeHtml(data.config.channelName)} ! Voici les derniers messages trouvés :
          </div>
          ${itemsHtml}
        `;
      }
    } catch (e) {
      els.testPreviewBox.innerHTML = `<div style="color:#f87171;font-weight:600;">❌ ${escapeHtml(e.message)}</div>`;
    } finally {
      els.btnTestConnection.disabled = false;
      els.btnTestConnection.textContent = '🔍 Tester & Voir les derniers embeds';
    }
  });

  // Preset buttons
  document.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyDatePreset(btn.getAttribute('data-preset'));
      applyRangesFromInputsAndRecalculate();
    });
  });

  // Clear Cache
  els.btnClearCache.addEventListener('click', async () => {
    const res = await fetch('/api/clear-cache', { method: 'POST' });
    const data = await res.json();
    els.btnClearCache.textContent = `✅ Cache vidé (${data.cleared})`;
    setTimeout(() => { els.btnClearCache.textContent = '🗑️ Vider le cache'; }, 2000);
  });

  // Employee Tabs
  document.querySelectorAll('[data-emp-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeEmployeeTab = btn.getAttribute('data-emp-tab');
      renderEmployeesTable();
    });
  });

  // Session Tabs & Filter pills
  document.querySelectorAll('[data-period-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activePeriodTab = btn.getAttribute('data-period-tab');
      renderSessionsTable();
    });
  });

  document.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-filter]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeSessionFilter = btn.getAttribute('data-filter');
      renderSessionsTable();
    });
  });

  els.btnExportCsv.addEventListener('click', exportToCsv);

  // Main Analyze Button
  els.btnAnalyze.addEventListener('click', async () => {
    els.errorBanner.classList.add('hidden');
    if (isPublicReadOnly) {
      applyRangesFromInputsAndRecalculate();
      return;
    }
    const conf = getFormConfig();

    if (!conf.token || !conf.channelInput) {
      els.configPanel.classList.remove('hidden');
      els.errorBanner.textContent = '⚠️ Merci de renseigner le lien du salon Discord et ton Token Discord dans la Configuration ci-dessus.';
      els.errorBanner.classList.remove('hidden');
      return;
    }

    if (!els.p1Start.value || !els.p1End.value) {
      els.errorBanner.textContent = '⚠️ Merci de choisir les dates de début et de fin de la Période 1.';
      els.errorBanner.classList.remove('hidden');
      return;
    }

    const p1StartMs = dateInputToStartMs(els.p1Start.value, els.p1StartTime && els.p1StartTime.value);
    const p1EndMs = dateInputToEndMs(els.p1End.value, els.p1EndTime && els.p1EndTime.value);

    const p2Enabled = els.p2Enabled.checked;
    const p2StartMs = p2Enabled && els.p2Start.value ? dateInputToStartMs(els.p2Start.value, els.p2StartTime && els.p2StartTime.value) : null;
    const p2EndMs = p2Enabled && els.p2End.value ? dateInputToEndMs(els.p2End.value, els.p2EndTime && els.p2EndTime.value) : null;

    els.btnAnalyze.disabled = true;
    els.progressContainer.classList.remove('hidden');
    els.progressBar.style.width = '5%';
    els.progressText.textContent = 'Lancement de la récupération...';
    els.progressPercent.textContent = '5%';

    // Start polling progress
    progressInterval = setInterval(async () => {
      try {
        const pRes = await fetch('/api/progress');
        const pData = await pRes.json();
        if (pData && pData.text) {
          els.progressText.textContent = pData.text;
          els.progressPercent.textContent = `${pData.percent || 0}%`;
          els.progressBar.style.width = `${pData.percent || 0}%`;
        }
      } catch (_) {}
    }, 600);

    try {
      const res = await fetch('/api/fetch-periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: conf,
          useCache: els.useCacheCheckbox.checked,
          period1: { startMs: p1StartMs, endMs: p1EndMs },
          period2: { enabled: p2Enabled, startMs: p2StartMs, endMs: p2EndMs }
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Erreur lors de la récupération');
      }

      currentConfig = data.config;
      updateChannelStatusUI(data.config);

      lastRawData = {
        period1Messages: data.period1Messages || [],
        period2Messages: data.period2Messages || null,
        p1Range: { startMs: p1StartMs, endMs: p1EndMs },
        p2Range: p2Enabled ? { startMs: p2StartMs, endMs: p2EndMs } : null,
        p1FetchedRange: { startMs: p1StartMs, endMs: p1EndMs },
        p2FetchedRange: p2Enabled ? { startMs: p2StartMs, endMs: p2EndMs } : null
      };

      populateCompanySelect();
      showAiNotice(data.aiStats);
      recalculateIfLoaded();
    } catch (err) {
      els.errorBanner.textContent = `❌ ${err.message}`;
      els.errorBanner.classList.remove('hidden');
    } finally {
      clearInterval(progressInterval);
      els.btnAnalyze.disabled = false;
      setTimeout(() => {
        els.progressContainer.classList.add('hidden');
      }, 1500);
    }
  });
}

init();
