import { useState, useEffect, useCallback, memo } from "react";

// ── Storage ───────────────────────────────────────────────────────────────────
const SK = { exercises: "gx_ex3", sessions: "gx_sess3", templates: "gx_tpl3" };
const load = async (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const save = async (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ── Utils ─────────────────────────────────────────────────────────────────────
const calc1RM = (w, r) => { if (!w || !r || +r <= 0) return 0; if (+r === 1) return +w; return Math.round(+w * (1 + +r / 30)); };
const todayISO = () => new Date().toISOString().split("T")[0];
const fmtDate = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
const fmtDateShort = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

const PERIODS = [
  { label: "1 MOIS", days: 30 },
  { label: "3 MOIS", days: 90 },
  { label: "6 MOIS", days: 180 },
  { label: "1 AN",   days: 365 },
  { label: "TOUT",   days: Infinity },
];

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: "#0c0c0c", nav: "#111", border: "#1e1e1e", border2: "#1a1a1a",
  text: "#e8e8e8", dim: "#aaa", dimmer: "#777", ghost: "#666", ghost2: "#3a3a3a",
  fill: "#131313", fill2: "#0f0f0f",
};
const mono  = { fontFamily: "'DM Mono', monospace" };
const bebas = { fontFamily: "'Bebas Neue', sans-serif" };

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500;600&family=Bebas+Neue&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { overflow-x: hidden; touch-action: pan-y; }
  body { background: ${C.bg}; }
  input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
  input:focus { outline: none; border-color: ${C.text} !important; }
  input::placeholder { color: ${C.ghost}; opacity: 1; font-size: 11px; }
  ::-webkit-scrollbar { width: 0; }
  button { cursor: pointer; font-family: inherit; }
  * { -webkit-touch-callout: none; }
`;

// ── Shared style helpers ──────────────────────────────────────────────────────
const sharedStyles = {
  root:     { ...mono, background: C.bg, minHeight: "100vh", color: C.text, maxWidth: 480, margin: "0 auto", paddingBottom: 80 },
  nav:      { display: "flex", background: C.nav, borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 20, paddingTop: "env(safe-area-inset-top)" },
  navBtn:   (a) => ({ flex: 1, padding: "10px 4px", border: "none", fontSize: 9, fontWeight: a ? 700 : 400, letterSpacing: "0.12em", textTransform: "uppercase", background: "transparent", color: a ? C.text : C.ghost, borderBottom: `2px solid ${a ? C.text : "transparent"}`, transition: "all 0.15s", ...mono }),
  pageTitle:{ fontSize: 9, color: C.ghost, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 4 },
  bigTitle: { ...bebas, fontSize: 36, color: C.text, letterSpacing: "1px", lineHeight: 1 },
  input:    { background: "#111", border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, padding: "9px 10px", fontSize: 13, width: "100%", ...mono },
  btn:      (p) => ({ background: p ? C.text : "transparent", color: p ? C.bg : C.ghost, border: p ? "none" : `1px solid ${C.border}`, borderRadius: 6, padding: "10px 16px", fontSize: 10, fontWeight: p ? 700 : 400, letterSpacing: "0.1em", textTransform: "uppercase", ...mono }),
  card:     { background: C.fill, border: `1px solid ${C.border}`, borderRadius: 8, margin: "8px 14px", overflow: "hidden" },
  rowBase:  { display: "flex", alignItems: "center", padding: "13px 14px", borderBottom: `1px solid ${C.border2}` },
  overlay:  { position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 50, display: "flex", alignItems: "flex-end" },
  sheet:    { background: "#101010", borderTop: `1px solid ${C.border}`, borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 480, margin: "0 auto", padding: "20px 14px 40px", maxHeight: "82vh", overflowY: "auto" },
};

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ data }) {
  if (!data || data.length < 2) return <span style={{ width: 60, fontSize: 9, color: C.ghost2, textAlign: "right" }}>—</span>;
  const vals = data.map(d => d.v);
  const mn = Math.min(...vals), mx = Math.max(...vals), rng = mx - mn || 1;
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * 58},${18 - ((d.v - mn) / rng) * 14}`).join(" ");
  return (
    <svg width={60} height={20}>
      <polyline points={pts} fill="none" stroke={C.dim} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Chart ─────────────────────────────────────────────────────────────────────
function Chart({ points, selectedIdx, onSelect }) {
  const W = 232, H = 120, PAD = { l: 30, r: 10, t: 12, b: 20 };
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b;

  if (!points || points.length === 0) return (
    <div style={{ width: W, height: H, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ ...mono, fontSize: 9, color: C.ghost, letterSpacing: "0.2em" }}>AUCUNE DONNÉE</span>
    </div>
  );

  const vals = points.map(p => p.orm);
  const minV = Math.min(...vals), maxV = Math.max(...vals), rangeV = maxV - minV || 10;
  const niceMin = Math.floor((minV - rangeV * 0.15) / 5) * 5;
  const niceMax = Math.ceil((maxV + rangeV * 0.15) / 5) * 5;
  const niceRange = niceMax - niceMin || 10;

  const toX = (i) => PAD.l + (points.length === 1 ? iW / 2 : (i / (points.length - 1)) * iW);
  const toY = (v) => PAD.t + iH - ((v - niceMin) / niceRange) * iH;
  const coords = points.map((p, i) => ({ x: toX(i), y: toY(p.orm) }));
  const polyline = coords.map(c => `${c.x},${c.y}`).join(" ");
  const area = `${coords[0].x},${PAD.t + iH} ${polyline} ${coords[coords.length - 1].x},${PAD.t + iH}`;

  const n = coords.length;
  const sumX = coords.reduce((a, _, i) => a + i, 0);
  const sumY = coords.reduce((a, c) => a + c.y, 0);
  const sumXY = coords.reduce((a, c, i) => a + i * c.y, 0);
  const sumX2 = coords.reduce((a, _, i) => a + i * i, 0);
  const slope = n > 1 ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) : 0;
  const intercept = (sumY - slope * sumX) / n;

  const ySteps = 3;
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => niceMin + Math.round((niceRange / ySteps) * i));
  const xStep = Math.max(1, Math.floor(points.length / 4));
  const xLabels = points.reduce((acc, p, i) => {
    if (i === 0 || i === points.length - 1 || i % xStep === 0) acc.push({ i, label: fmtDateShort(p.date) });
    return acc;
  }, []);

  return (
    <svg width={W} height={H} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.text} stopOpacity="0.08" />
          <stop offset="100%" stopColor={C.text} stopOpacity="0" />
        </linearGradient>
        <clipPath id="cc"><rect x={PAD.l} y={PAD.t} width={iW} height={iH} /></clipPath>
      </defs>
      {yLabels.map((v, i) => {
        const y = toY(v);
        return <g key={i}>
          <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="#161616" strokeWidth="1" />
          <text x={PAD.l - 4} y={y + 3} style={{ ...mono, fontSize: 6, fill: C.ghost2 }} textAnchor="end">{v}</text>
        </g>;
      })}
      {n > 3 && <line x1={coords[0].x} y1={intercept} x2={coords[n-1].x} y2={slope*(n-1)+intercept} stroke={C.ghost2} strokeWidth="1" strokeDasharray="3,3" clipPath="url(#cc)" />}
      {selectedIdx !== null && <line x1={coords[selectedIdx].x} y1={PAD.t} x2={coords[selectedIdx].x} y2={PAD.t + iH} stroke={C.ghost} strokeWidth="1" strokeDasharray="2,2" />}
      <polygon points={area} fill="url(#ag)" clipPath="url(#cc)" />
      {n > 1 && (
        selectedIdx !== null
          ? <polyline points={polyline} fill="none" stroke={C.ghost2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" clipPath="url(#cc)" />
          : <polyline points={polyline} fill="none" stroke={C.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" clipPath="url(#cc)" />
      )}
      {selectedIdx !== null && selectedIdx > 0 && <line x1={coords[selectedIdx-1].x} y1={coords[selectedIdx-1].y} x2={coords[selectedIdx].x} y2={coords[selectedIdx].y} stroke={C.dim} strokeWidth="1.8" clipPath="url(#cc)" />}
      {selectedIdx !== null && selectedIdx < n-1 && <line x1={coords[selectedIdx].x} y1={coords[selectedIdx].y} x2={coords[selectedIdx+1].x} y2={coords[selectedIdx+1].y} stroke={C.dim} strokeWidth="1.8" clipPath="url(#cc)" />}
      {coords.map((c, i) => {
        const isSel = selectedIdx === i;
        const isLast = i === n - 1 && selectedIdx === null;
        if (isSel) return <g key={i}><circle cx={c.x} cy={c.y} r={7} fill={C.bg} stroke={C.text} strokeWidth="2" style={{ cursor: "pointer" }} onClick={() => onSelect(null)} /><circle cx={c.x} cy={c.y} r={2.5} fill={C.text} style={{ pointerEvents: "none" }} /></g>;
        if (isLast) return <g key={i}><circle cx={c.x} cy={c.y} r={5} fill={C.bg} stroke={C.text} strokeWidth="2" style={{ cursor: "pointer" }} onClick={() => onSelect(i)} /><circle cx={c.x} cy={c.y} r={1.8} fill={C.text} style={{ pointerEvents: "none" }} /></g>;
        return <circle key={i} cx={c.x} cy={c.y} r={2.5} fill={selectedIdx !== null ? C.ghost2 : C.fill} stroke={selectedIdx !== null ? C.ghost2 : C.ghost} strokeWidth="1.2" style={{ cursor: "pointer" }} onClick={() => onSelect(i)} />;
      })}
      {selectedIdx !== null && (() => {
        const c = coords[selectedIdx], p = points[selectedIdx];
        const bx = Math.min(Math.max(c.x - 28, PAD.l), W - PAD.r - 56);
        const by = c.y - 44 < PAD.t ? c.y + 10 : c.y - 44;
        return <g>
          <rect x={bx} y={by} width={56} height={34} rx={4} fill="#1c1c1c" stroke={C.ghost} strokeWidth="1" />
          <text x={bx+28} y={by+13} style={{ ...bebas, fontSize: 13, fill: C.text }} textAnchor="middle">{p.orm} KG</text>
          <text x={bx+28} y={by+22} style={{ ...mono, fontSize: 6, fill: C.dimmer }} textAnchor="middle">1RM EST.</text>
          <line x1={bx+28} y1={by+25} x2={bx+28} y2={by+28} stroke={C.ghost} strokeWidth="0.5" />
          <text x={bx+28} y={by+33} style={{ ...mono, fontSize: 6, fill: C.ghost }} textAnchor="middle">{fmtDateShort(p.date)}</text>
        </g>;
      })()}
      {xLabels.map(({ i, label }) => <text key={i} x={coords[i].x} y={H-2} style={{ ...mono, fontSize: 6, fill: selectedIdx === i ? C.dim : C.ghost2 }} textAnchor="middle">{label}</text>)}
    </svg>
  );
}

// ── SetRow — composant stable pour éviter le re-mount à chaque frappe ─────────
const SetRow = memo(function SetRow({ exId, setIdx, reps, weight, orm, onUpdate, onRemove }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "5px 14px" }}>
      <span style={{ fontSize: 12, color: C.dim, flex: "0 0 24px", fontWeight: 600 }}>S{setIdx + 1}</span>
      <input
        style={{ background: "#111", border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, flex: 1, padding: "8px 6px", textAlign: "center", fontSize: 14, ...mono }}
        type="number" inputMode="decimal" placeholder="REPS" value={reps}
        onChange={e => onUpdate(exId, setIdx, "reps", e.target.value)}
      />
      <input
        style={{ background: "#111", border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, flex: 1, padding: "8px 6px", textAlign: "center", fontSize: 14, ...mono }}
        type="number" inputMode="decimal" placeholder="KG" value={weight}
        onChange={e => onUpdate(exId, setIdx, "weight", e.target.value)}
      />
      <span style={{ fontSize: 12, color: orm > 0 ? C.text : C.ghost2, fontWeight: 600, flex: 1, textAlign: "right" }}>
        {orm > 0 ? orm : "—"}
      </span>
      <button
        style={{ flex: "0 0 20px", background: "none", border: "none", color: C.ghost2, fontSize: 17, padding: 0 }}
        onMouseEnter={e => e.target.style.color = "#ef4444"}
        onMouseLeave={e => e.target.style.color = C.ghost2}
        onClick={() => onRemove(exId, setIdx)}>×</button>
    </div>
  );
});

// ── ExerciseBlock — composant stable pour chaque exo dans la séance ───────────
const ExerciseBlock = memo(function ExerciseBlock({ ex, sets, isOpen, onToggle, onUpdate, onAddSet, onRemoveSet }) {
  const validSets = sets.filter(s => s.reps && s.weight);
  const maxOrm = validSets.length ? Math.max(...validSets.map(s => calc1RM(s.weight, s.reps))) : 0;
  return (
    <div style={{ borderBottom: `1px solid ${C.border2}` }}>
      <div style={{ display: "flex", alignItems: "center", padding: "13px 14px", cursor: "pointer" }} onClick={onToggle}>
        <div style={{ width: 3, height: 32, background: isOpen ? C.text : C.ghost2, borderRadius: 1, marginRight: 12, flexShrink: 0, transition: "background 0.15s" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...bebas, fontSize: 20, color: C.text, letterSpacing: "0.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ex.name.toUpperCase()}</div>
          {maxOrm > 0 && <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{validSets.length} SÉRIE{validSets.length > 1 ? "S" : ""} · 1RM {maxOrm}KG</div>}
        </div>
        <span style={{ color: C.ghost2, fontSize: 11 }}>{isOpen ? "▲" : "▼"}</span>
      </div>
      {isOpen && (
        <div style={{ paddingBottom: 8, background: C.fill2 }}>
          <div style={{ display: "flex", padding: "8px 14px 6px", gap: 8 }}>
            {["#", "REPS", "KG", "1RM", ""].map((h, hi) => (
              <span key={hi} style={{ fontSize: 11, color: C.ghost, letterSpacing: "0.1em", flex: hi === 0 ? "0 0 24px" : hi === 4 ? "0 0 20px" : 1, textAlign: hi === 3 ? "right" : "left" }}>{h}</span>
            ))}
          </div>
          {sets.map((set, i) => (
            <SetRow key={`${ex.id}-${i}`}
              exId={ex.id} setIdx={i}
              reps={set.reps} weight={set.weight}
              orm={calc1RM(set.weight, set.reps)}
              onUpdate={onUpdate} onRemove={onRemoveSet}
            />
          ))}
          <button
            style={{ background: "none", border: `1px dashed ${C.border}`, borderRadius: 6, color: C.ghost, padding: "8px", width: "calc(100% - 28px)", margin: "6px 14px 4px", fontSize: 11, letterSpacing: "0.1em", ...mono }}
            onClick={() => onAddSet(ex.id)}>+ SÉRIE</button>
        </div>
      )}
    </div>
  );
});

// ── ExNameInput — input stable pour la modale ─────────────────────────────────
const StableInput = memo(function StableInput({ value, onChange, onKeyDown, placeholder, style }) {
  return <input value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder} style={style} autoComplete="off" autoCorrect="off" spellCheck="false" />;
});

// ── App ───────────────────────────────────────────────────────────────────────
export default function GymTracker() {
  const [exercises, setExercises]       = useState([]);
  const [templates, setTemplates]       = useState([]);
  const [sessions, setSessions]         = useState({});
  const [view, setView]                 = useState("home");
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [currentSets, setCurrentSets]   = useState({});
  const [openEx, setOpenEx]             = useState(null);
  const [histExId, setHistExId]         = useState(null);
  const [histPeriod, setHistPeriod]     = useState(4);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [modal, setModal]               = useState(null);
  const [editingTpl, setEditingTpl]     = useState(null);
  const [tplName, setTplName]           = useState("");
  const [tplExIds, setTplExIds]         = useState([]);
  const [newExName, setNewExName]       = useState("");

  useEffect(() => {
    (async () => {
      const ex  = await load(SK.exercises, [
        { id: "1", name: "Développé couché" }, { id: "2", name: "Squat barre" },
        { id: "3", name: "Tractions" },        { id: "4", name: "Curl biceps" },
        { id: "5", name: "Dips" },             { id: "6", name: "Élévations latérales" },
        { id: "7", name: "Leg press" },        { id: "8", name: "Soulevé de terre" },
        { id: "9", name: "Développé militaire" }, { id: "10", name: "Crunchs" },
      ]);
      const tpl = await load(SK.templates, [
        { id: "t1", name: "Pec / Dos / Abdos",          exIds: ["1","3","10"] },
        { id: "t2", name: "Biceps / Triceps / Épaules", exIds: ["4","5","6","9"] },
        { id: "t3", name: "Jambes / Abdos",             exIds: ["2","7","8","10"] },
      ]);
      const se  = await load(SK.sessions, {});
      setExercises(ex); setTemplates(tpl); setSessions(se);
    })();
  }, []);

  const persist = useCallback(async (ex, tpl, se) => {
    await save(SK.exercises, ex ?? exercises);
    await save(SK.templates, tpl ?? templates);
    await save(SK.sessions,  se ?? sessions);
  }, [exercises, templates, sessions]);

  // ── Callbacks stables ──────────────────────────────────────────────────────
  const updateSet = useCallback((exId, i, field, val) => {
    setCurrentSets(prev => {
      const sets = [...(prev[exId] || [])];
      sets[i] = { ...sets[i], [field]: val };
      return { ...prev, [exId]: sets };
    });
  }, []);

  const addSet = useCallback((exId) => {
    setCurrentSets(prev => ({ ...prev, [exId]: [...(prev[exId] || []), { reps: "", weight: "" }] }));
  }, []);

  const removeSet = useCallback((exId, i) => {
    setCurrentSets(prev => ({ ...prev, [exId]: prev[exId].filter((_, idx) => idx !== i) }));
  }, []);

  const toggleEx = useCallback((exId) => {
    setOpenEx(prev => prev === exId ? null : exId);
  }, []);

  // ── Templates ──────────────────────────────────────────────────────────────
  const saveTpl = () => {
    if (!tplName.trim() || tplExIds.length === 0) return;
    const upd = editingTpl
      ? templates.map(t => t.id === editingTpl.id ? { ...t, name: tplName.trim(), exIds: tplExIds } : t)
      : [...templates, { id: Date.now().toString(), name: tplName.trim(), exIds: tplExIds }];
    setTemplates(upd); persist(null, upd, null);
    setModal(null); setEditingTpl(null); setTplName(""); setTplExIds([]);
  };

  const deleteTpl = (id) => { const upd = templates.filter(t => t.id !== id); setTemplates(upd); persist(null, upd, null); };
  const editTpl   = (tpl) => { setEditingTpl(tpl); setTplName(tpl.name); setTplExIds([...tpl.exIds]); setModal("tpl"); };

  // ── Exercices ──────────────────────────────────────────────────────────────
  const addEx = () => {
    if (!newExName.trim()) return;
    const upd = [...exercises, { id: Date.now().toString(), name: newExName.trim() }];
    setExercises(upd); persist(upd, null, null);
    setNewExName(""); setModal(null);
  };
  const deleteEx = (id) => {
    const exUpd  = exercises.filter(e => e.id !== id);
    const tplUpd = templates.map(t => ({ ...t, exIds: t.exIds.filter(eid => eid !== id) }));
    setExercises(exUpd); setTemplates(tplUpd); persist(exUpd, tplUpd, null);
  };

  // ── Workout ────────────────────────────────────────────────────────────────
  const startWorkout = (tpl) => {
    const init = {};
    tpl.exIds.forEach(id => { init[id] = [{ reps: "", weight: "" }]; });
    setActiveTemplate(tpl); setCurrentSets(init); setOpenEx(tpl.exIds[0]); setView("workout");
  };

  const saveSession = () => {
    const data = {};
    Object.entries(currentSets).forEach(([exId, sets]) => {
      const valid = sets.filter(s => s.reps && s.weight);
      if (valid.length) data[exId] = valid;
    });
    if (!Object.keys(data).length) return;
    const key   = `${todayISO()}_${Date.now()}`;
    const newSe = { ...sessions, [key]: { date: todayISO(), templateId: activeTemplate?.id, templateName: activeTemplate?.name, sets: data } };
    setSessions(newSe); persist(null, null, newSe);
    setView("home"); setActiveTemplate(null); setCurrentSets({});
  };

  // ── History ────────────────────────────────────────────────────────────────
  const getExHistory = (exId, periodDays) => {
    const cutoff = periodDays === Infinity ? null : new Date(Date.now() - periodDays * 86400000).toISOString().split("T")[0];
    return Object.values(sessions)
      .filter(s => s.sets?.[exId] && (!cutoff || s.date >= cutoff))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(s => {
        const sets = s.sets[exId];
        const best = sets.reduce((acc, set) => { const o = calc1RM(set.weight, set.reps); return o > acc.orm ? { ...set, orm: o } : acc; }, { orm: 0 });
        return { date: s.date, sets, orm: best.orm };
      });
  };

  const S = sharedStyles;

  // ── RENDER ─────────────────────────────────────────────────────────────────
  const isHistory = view === "history" || view === "histDetail";

  return (
    <div style={S.root}>
      <style>{css}</style>

      {/* Nav */}
      <div style={S.nav}>
        <button style={S.navBtn(view === "home" || view === "workout")} onClick={() => setView("home")}>ACCUEIL</button>
        <button style={S.navBtn(isHistory)} onClick={() => { setView("history"); setSelectedPoint(null); }}>HISTORIQUE</button>
        <button style={S.navBtn(view === "manage")} onClick={() => setView("manage")}>EXERCICES</button>
      </div>

      {/* ── HOME ── */}
      {view === "home" && (
        <div>
          <div style={{ padding: "22px 14px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={S.pageTitle}>TRACKER /</div>
              <div style={S.bigTitle}>LIFT LOG</div>
              <div style={{ width: 60, height: 1, background: C.ghost2, marginTop: 6 }} />
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ ...bebas, fontSize: 28, color: C.ghost }}>{Object.keys(sessions).length}</div>
              <div style={{ fontSize: 8, color: C.ghost2, letterSpacing: "0.15em" }}>SÉANCES</div>
            </div>
          </div>
          <div style={{ padding: "0 14px 10px" }}>
            <div style={{ fontSize: 10, color: C.dim, letterSpacing: "0.25em", marginBottom: 8 }}>MES SÉANCES</div>
          </div>
          {templates.map((tpl, idx) => {
            const count = Object.values(sessions).filter(s => s.templateId === tpl.id).length;
            const barW  = Math.min(100, count * 8);
            return (
              <div key={tpl.id} style={{ ...S.card, cursor: "pointer", transition: "border-color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.dim}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
                onClick={() => startWorkout(tpl)}>
                <div style={{ display: "flex", alignItems: "center", padding: "14px 14px 10px" }}>
                  <div style={{ width: 3, height: 48, background: idx === 0 ? C.text : idx === 1 ? C.ghost : C.ghost2, borderRadius: 1, marginRight: 12, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ ...bebas, fontSize: 22, color: C.text, letterSpacing: "0.5px" }}>{tpl.name.toUpperCase()}</div>
                    <div style={{ fontSize: 10, color: C.ghost, letterSpacing: "0.15em", marginTop: 4 }}>
                      {tpl.exIds.length} EXERCICE{tpl.exIds.length > 1 ? "S" : ""} · {count} SÉANCE{count !== 1 ? "S" : ""}
                    </div>
                    <div style={{ marginTop: 6, height: 2, width: "100%", background: C.border }}>
                      <div style={{ height: "100%", width: `${barW}%`, background: idx === 0 ? C.text : idx === 1 ? C.dim : C.ghost, borderRadius: 1 }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginLeft: 10, gap: 8 }}>
                    <span style={{ fontSize: 16, color: C.dim }}>›</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={e => { e.stopPropagation(); editTpl(tpl); }}
                        style={{ background: "#1e1e1e", border: `1px solid ${C.border}`, borderRadius: 6, color: C.dim, fontSize: 14, padding: "5px 8px", ...mono }}>✎</button>
                      <button onClick={e => { e.stopPropagation(); deleteTpl(tpl.id); }}
                        style={{ background: "#1e1e1e", border: `1px solid ${C.border}`, borderRadius: 6, color: C.dim, fontSize: 16, padding: "5px 8px" }}
                        onMouseEnter={e => e.target.style.color = "#ef4444"} onMouseLeave={e => e.target.style.color = C.dim}>×</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div style={{ margin: "8px 14px" }}>
            <button style={{ ...S.btn(false), width: "100%", padding: "14px", borderStyle: "dashed", borderColor: C.dim, color: C.dim, fontSize: 11 }}
              onClick={() => { setEditingTpl(null); setTplName(""); setTplExIds([]); setModal("tpl"); }}>
              + NOUVELLE SÉANCE
            </button>
          </div>
        </div>
      )}

      {/* ── WORKOUT ── */}
      {view === "workout" && activeTemplate && (
        <div>
          <div style={{ padding: "18px 14px 12px", display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => { setView("home"); setActiveTemplate(null); }} style={{ background: "none", border: "none", color: C.dim, fontSize: 16, padding: 0, ...mono }}>←</button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 8, color: C.ghost, letterSpacing: "0.2em", textTransform: "uppercase" }}>SÉANCE EN COURS</div>
              <div style={{ ...bebas, fontSize: 22, color: C.text, letterSpacing: "0.5px" }}>{activeTemplate.name.toUpperCase()}</div>
            </div>
          </div>
          {activeTemplate.exIds.map(id => exercises.find(e => e.id === id)).filter(Boolean).map(ex => (
            <ExerciseBlock
              key={ex.id} ex={ex}
              sets={currentSets[ex.id] || []}
              isOpen={openEx === ex.id}
              onToggle={() => toggleEx(ex.id)}
              onUpdate={updateSet}
              onAddSet={addSet}
              onRemoveSet={removeSet}
            />
          ))}
          <button style={{ ...S.btn(true), width: "calc(100% - 28px)", margin: "14px", padding: "13px", fontSize: 10, display: "block" }} onClick={saveSession}>
            SAUVEGARDER LA SÉANCE ✓
          </button>
        </div>
      )}

      {/* ── HISTORIQUE LISTE ── */}
      {view === "history" && (
        <div>
          <div style={{ padding: "22px 14px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={S.pageTitle}>PROGRESSION /</div>
              <div style={S.bigTitle}>EXERCICES</div>
              <div style={{ width: 60, height: 1, background: C.ghost2, marginTop: 6 }} />
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ ...bebas, fontSize: 28, color: C.ghost }}>{Object.keys(sessions).length}</div>
              <div style={{ fontSize: 8, color: C.ghost2, letterSpacing: "0.15em" }}>SÉANCES TOTAL</div>
            </div>
          </div>
          {exercises.map((ex, idx) => {
            const hist     = getExHistory(ex.id, Infinity);
            const best     = hist.length ? Math.max(...hist.map(h => h.orm)) : 0;
            const hasData  = hist.length > 0;
            const sparkData = hist.slice(-6).map(h => ({ v: h.orm }));
            return (
              <div key={ex.id} style={{ ...S.rowBase, cursor: hasData ? "pointer" : "default", transition: "background 0.1s" }}
                onClick={() => { if (hasData) { setHistExId(ex.id); setSelectedPoint(null); setHistPeriod(4); setView("histDetail"); } }}
                onMouseEnter={e => { if (hasData) e.currentTarget.style.background = "#0f0f0f"; }}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div style={{ width: 3, height: 36, background: hasData ? (idx < 3 ? C.text : C.ghost) : C.border, borderRadius: 1, marginRight: 12, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ ...bebas, fontSize: 20, color: hasData ? C.text : C.ghost, letterSpacing: "0.5px" }}>{ex.name.toUpperCase()}</div>
                  <div style={{ fontSize: 10, color: C.ghost, marginTop: 3, letterSpacing: "0.1em" }}>
                    {hasData ? <>{hist.length} SÉANCE{hist.length > 1 ? "S" : ""} · <span style={{ color: C.dim }}>1RM MAX {best}KG</span></> : "AUCUNE DONNÉE"}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Sparkline data={sparkData} />
                  <span style={{ color: C.ghost2, fontSize: 12 }}>{hasData ? "›" : ""}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── HISTORIQUE DÉTAIL ── */}
      {view === "histDetail" && (() => {
        const ex       = exercises.find(e => e.id === histExId);
        if (!ex) return null;
        const period   = PERIODS[histPeriod];
        const hist     = getExHistory(histExId, period.days);
        const allHist  = getExHistory(histExId, Infinity);
        const best     = allHist.length ? Math.max(...allHist.map(h => h.orm)) : 0;
        const prog     = hist.length >= 2 ? hist[hist.length-1].orm - hist[0].orm : 0;
        const selSess  = selectedPoint !== null ? hist[selectedPoint] : null;
        return (
          <div>
            <div style={{ padding: "18px 14px 10px", display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => { setView("history"); setSelectedPoint(null); }} style={{ background: "none", border: "none", color: C.dim, fontSize: 16, padding: 0, ...mono }}>←</button>
              <div>
                <div style={{ fontSize: 8, color: C.ghost, letterSpacing: "0.2em", textTransform: "uppercase" }}>EXERCICE /</div>
                <div style={{ ...bebas, fontSize: 24, color: C.text, letterSpacing: "0.5px" }}>{ex.name.toUpperCase()}</div>
              </div>
            </div>
            <div style={{ height: 1, background: C.border2 }} />
            <div style={{ display: "flex", gap: 8, padding: "12px 14px" }}>
              {[
                { v: selSess ? `${selSess.orm}KG` : (best ? `${best}KG` : "—"), l: selSess ? "1RM SÉANCE" : "1RM MAX", hi: !!selSess },
                { v: selSess ? fmtDateShort(selSess.date) : `${hist.length}`, l: selSess ? "DATE" : "SÉANCES", hi: false },
                { v: prog !== 0 ? `${prog > 0 ? "+" : ""}${prog}KG` : "—", l: "PROGRESSION", hi: false },
              ].map(({ v, l, hi }, i) => (
                <div key={i} style={{ background: "#111", border: `1px solid ${hi ? C.dim : C.border}`, borderRadius: 6, padding: "10px 8px", textAlign: "center", flex: 1 }}>
                  <div style={{ ...bebas, fontSize: 16, color: hi ? C.text : C.dim }}>{v}</div>
                  <div style={{ fontSize: 7, color: C.ghost, letterSpacing: "0.12em", marginTop: 3 }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", margin: "0 14px 12px", background: C.fill2, border: `1px solid ${C.border}`, borderRadius: 20, padding: "3px" }}>
              {PERIODS.map((p, i) => (
                <button key={i} onClick={() => { setHistPeriod(i); setSelectedPoint(null); }}
                  style={{ flex: 1, padding: "6px 2px", borderRadius: 16, border: "none", fontSize: 8, letterSpacing: "0.08em", fontWeight: i === histPeriod ? 700 : 400, background: i === histPeriod ? C.text : "transparent", color: i === histPeriod ? C.bg : C.ghost, transition: "all 0.15s", ...mono }}>
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 7, color: C.ghost2, letterSpacing: "0.2em", padding: "0 14px 6px" }}>1RM ESTIMÉ (KG)</div>
            <div style={{ margin: "0 14px 12px", background: C.fill2, border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 10px 4px 10px" }}>
              <Chart points={hist} selectedIdx={selectedPoint} onSelect={setSelectedPoint} />
            </div>
            <div style={{ fontSize: 7, color: C.ghost2, letterSpacing: "0.2em", padding: "0 14px 8px" }}>{selSess ? "SÉANCE SÉLECTIONNÉE" : "SÉANCES"}</div>
            {selSess && (
              <div style={{ margin: "0 14px 10px", background: "#111", border: `1px solid ${C.dim}`, borderRadius: 8, overflow: "hidden" }}>
                <div style={{ display: "flex", padding: "12px 14px 8px" }}>
                  <div style={{ width: 3, minHeight: 40, background: C.text, borderRadius: 1, marginRight: 12, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: C.text, marginBottom: 8 }}>{fmtDate(selSess.date)}</div>
                    {selSess.sets.map((set, si) => (
                      <div key={si} style={{ display: "flex", gap: 10, fontSize: 10, color: C.dim, marginBottom: 4 }}>
                        <span style={{ color: C.ghost, minWidth: 20 }}>S{si+1}</span>
                        <span>{set.reps} reps × {set.weight} kg</span>
                        <span style={{ marginLeft: "auto", color: C.ghost }}>→ {calc1RM(set.weight, set.reps)}kg</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ ...bebas, fontSize: 20, color: C.text }}>{selSess.orm}</div>
                    <div style={{ fontSize: 7, color: C.ghost, letterSpacing: "0.1em" }}>1RM KG</div>
                  </div>
                </div>
              </div>
            )}
            {hist.slice().reverse().map((h, i) => {
              if (selSess && h.date === selSess.date && h.orm === selSess.orm) return null;
              return (
                <div key={i} style={{ ...S.rowBase, opacity: selSess ? 0.4 : 1 }}>
                  <div style={{ width: 3, height: 32, background: C.ghost2, borderRadius: 1, marginRight: 12, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: C.dim }}>{fmtDate(h.date)}</div>
                    <div style={{ fontSize: 8, color: C.ghost, marginTop: 2 }}>{h.sets.map((s, si) => `S${si+1} ${s.reps}×${s.weight}kg`).join("  ")}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ ...bebas, fontSize: 14, color: C.dim }}>{h.orm}</div>
                    <div style={{ fontSize: 7, color: C.ghost2, letterSpacing: "0.1em" }}>1RM</div>
                  </div>
                </div>
              );
            })}
            {hist.length === 0 && <div style={{ textAlign: "center", color: C.ghost2, padding: "32px 14px", fontSize: 9, letterSpacing: "0.2em" }}>AUCUNE DONNÉE SUR CETTE PÉRIODE</div>}
          </div>
        );
      })()}

      {/* ── EXERCICES ── */}
      {view === "manage" && (
        <div>
          <div style={{ padding: "22px 14px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={S.pageTitle}>BIBLIOTHÈQUE /</div>
              <div style={S.bigTitle}>EXERCICES</div>
              <div style={{ width: 60, height: 1, background: C.ghost2, marginTop: 6 }} />
            </div>
            <button style={{ ...S.btn(true), padding: "8px 12px", fontSize: 9 }} onClick={() => setModal("ex")}>+ AJOUTER</button>
          </div>
          {exercises.map((ex, idx) => {
            const count = getExHistory(ex.id, Infinity).length;
            return (
              <div key={ex.id} style={S.rowBase}>
                <div style={{ width: 3, height: 32, background: idx < 3 ? C.dim : C.ghost2, borderRadius: 1, marginRight: 12, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ ...bebas, fontSize: 20, color: C.text, letterSpacing: "0.5px" }}>{ex.name.toUpperCase()}</div>
                  <div style={{ fontSize: 10, color: C.ghost, marginTop: 3, letterSpacing: "0.1em" }}>{count} SÉANCE{count !== 1 ? "S" : ""}</div>
                </div>
                <button style={{ background: "none", border: "none", color: C.ghost2, fontSize: 18, padding: "0 4px" }}
                  onMouseEnter={e => e.target.style.color = "#ef4444"} onMouseLeave={e => e.target.style.color = C.ghost2}
                  onClick={() => deleteEx(ex.id)}>×</button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL ── */}
      {modal && (
        <div style={S.overlay} onClick={() => setModal(null)}>
          <div style={S.sheet} onClick={e => e.stopPropagation()}>
            <div style={{ width: 32, height: 3, background: C.border, borderRadius: 2, margin: "0 auto 18px" }} />
            {modal === "tpl" && (
              <>
                <div style={{ ...bebas, fontSize: 21, color: C.text, marginBottom: 16, letterSpacing: "1px" }}>
                  {editingTpl ? "MODIFIER SÉANCE" : "NOUVELLE SÉANCE"}
                </div>
                <div style={{ fontSize: 8, color: C.ghost, letterSpacing: "0.2em", marginBottom: 6 }}>NOM DE LA SÉANCE</div>
                <StableInput
                  style={{ ...S.input, marginBottom: 14 }}
                  placeholder="Ex : Pec / Dos / Abdos"
                  value={tplName}
                  onChange={e => setTplName(e.target.value)}
                />
                <div style={{ fontSize: 8, color: C.ghost, letterSpacing: "0.2em", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                  <span>EXERCICES</span>
                  <span style={{ color: tplExIds.length ? C.dim : C.ghost }}>{tplExIds.length} SÉLECTIONNÉ{tplExIds.length > 1 ? "S" : ""}</span>
                </div>
                <div style={{ maxHeight: 240, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 14 }}>
                  {exercises.map((ex, idx) => {
                    const on = tplExIds.includes(ex.id);
                    return (
                      <div key={ex.id} onClick={() => setTplExIds(on ? tplExIds.filter(i => i !== ex.id) : [...tplExIds, ex.id])}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", cursor: "pointer", background: on ? "#1a1a1a" : "transparent", borderBottom: idx < exercises.length - 1 ? `1px solid ${C.border2}` : "none" }}>
                        <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${on ? C.text : C.ghost}`, background: on ? C.text : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                          {on && <span style={{ fontSize: 9, color: C.bg, fontWeight: 800 }}>✓</span>}
                        </div>
                        <span style={{ ...bebas, fontSize: 20, color: on ? C.text : C.dim, letterSpacing: "0.5px" }}>{ex.name.toUpperCase()}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...S.btn(true), flex: 1 }} onClick={saveTpl}>{editingTpl ? "ENREGISTRER" : "CRÉER"}</button>
                  <button style={{ ...S.btn(false), padding: "10px 14px" }} onClick={() => setModal(null)}>✕</button>
                </div>
              </>
            )}
            {modal === "ex" && (
              <>
                <div style={{ ...bebas, fontSize: 21, color: C.text, marginBottom: 16, letterSpacing: "1px" }}>AJOUTER UN EXERCICE</div>
                <div style={{ fontSize: 8, color: C.ghost, letterSpacing: "0.2em", marginBottom: 6 }}>NOM</div>
                <StableInput
                  style={{ ...S.input, marginBottom: 14 }}
                  placeholder="Ex : Curl marteau"
                  value={newExName}
                  onChange={e => setNewExName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addEx()}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...S.btn(true), flex: 1 }} onClick={addEx}>AJOUTER</button>
                  <button style={{ ...S.btn(false), padding: "10px 14px" }} onClick={() => setModal(null)}>✕</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
