import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
  Dimensions,
  Animated,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* ─── Board geometry ──────────────────────────────────────────────────────── */
const { width: SW } = Dimensions.get('window');
const HP = 20;   // root horizontal padding
const CP = 12;   // board card padding
const CG = 8;    // gap between cells
const BOARD_W = Math.min(SW - (HP + CP) * 2, 308);
const CS      = Math.floor((BOARD_W - CG * 2) / 3);   // cell size

/* ─── Types ──────────────────────────────────────────────────────────────── */
type Piece = 'X' | 'O' | null;
type Diff  = 'easy' | 'medium' | 'hard';
type Score = { w: number; l: number; d: number };
type Stats = Record<Diff, Score>;
type GRes  = { winner: string; line: number[] } | null;
type Scr   = 'menu' | 'game';
type Theme = typeof DARK;

/* ─── Difficulty config ──────────────────────────────────────────────────── */
const DIFFS: Record<Diff, {
  emoji: string; label: string; desc: string;
  thinking: string; color: string; delay: number;
}> = {
  easy: {
    emoji: '🌱', label: 'ROOKIE',
    desc: 'AI plays randomly. Perfect for beginners!',
    thinking: 'Rookie is confused… 🤔',
    color: '#4ADE80', delay: 260,
  },
  medium: {
    emoji: '⚡', label: 'VETERAN',
    desc: 'AI blocks & attacks. Stay sharp.',
    thinking: 'Veteran is plotting… ⚡',
    color: '#FBBF24', delay: 500,
  },
  hard: {
    emoji: '💀', label: 'LEGEND',
    desc: 'Unbeatable AI. A draw is glory.',
    thinking: 'Legend sees all futures… 💀',
    color: '#F87171', delay: 640,
  },
};

/* ─── Win lines ──────────────────────────────────────────────────────────── */
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

/* ─── Game logic ─────────────────────────────────────────────────────────── */
function checkResult(b: Piece[]): GRes {
  for (const [a, x, c] of LINES) {
    if (b[a] && b[a] === b[x] && b[a] === b[c])
      return { winner: b[a]!, line: [a, x, c] };
  }
  return b.every(Boolean) ? { winner: 'draw', line: [] } : null;
}

function minimax(b: Piece[], isMax: boolean, depth: number): number {
  const r = checkResult(b);
  if (r) return r.winner === 'O' ? 10 - depth : r.winner === 'X' ? depth - 10 : 0;
  let best = isMax ? -Infinity : Infinity;
  for (let i = 0; i < 9; i++) {
    if (!b[i]) {
      b[i] = isMax ? 'O' : 'X';
      const v = minimax(b, !isMax, depth + 1);
      b[i] = null;
      best = isMax ? Math.max(best, v) : Math.min(best, v);
    }
  }
  return best;
}

function hardMove(b: Piece[]): number {
  let [best, mv] = [-Infinity, -1];
  for (let i = 0; i < 9; i++) {
    if (!b[i]) {
      b[i] = 'O';
      const v = minimax(b, false, 0);
      b[i] = null;
      if (v > best) { best = v; mv = i; }
    }
  }
  return mv;
}

function randOf(b: Piece[]): number {
  const e = b.reduce<number[]>((a, v, i) => (v ? a : [...a, i]), []);
  return e.length ? e[Math.floor(Math.random() * e.length)] : -1;
}

function mediumMove(b: Piece[]): number {
  for (let i = 0; i < 9; i++) {   // take win
    if (!b[i]) { b[i] = 'O'; const r = checkResult(b); b[i] = null; if (r?.winner === 'O') return i; }
  }
  for (let i = 0; i < 9; i++) {   // block player
    if (!b[i]) { b[i] = 'X'; const r = checkResult(b); b[i] = null; if (r?.winner === 'X') return i; }
  }
  if (!b[4]) return 4;             // center
  const corners = [0, 2, 6, 8].filter(i => !b[i]);
  if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
  return randOf(b);
}

function getMove(b: Piece[], diff: Diff): number {
  if (diff === 'easy')   return randOf(b);
  if (diff === 'medium') return mediumMove(b);
  return hardMove(b);
}

/* ─── Storage ────────────────────────────────────────────────────────────── */
const SK = '@xoclash3:stats';
const TK = '@xoclash3:theme';
const E0: Stats = { easy: { w:0, l:0, d:0 }, medium: { w:0, l:0, d:0 }, hard: { w:0, l:0, d:0 } };

async function loadData(): Promise<{ stats: Stats; dark: boolean }> {
  try {
    const [rs, rt] = await Promise.all([AsyncStorage.getItem(SK), AsyncStorage.getItem(TK)]);
    return { stats: rs ? JSON.parse(rs) : E0, dark: rt !== 'light' };
  } catch { return { stats: E0, dark: true }; }
}
const saveStats = async (s: Stats) =>
  { try { await AsyncStorage.setItem(SK, JSON.stringify(s)); } catch {} };
const saveTheme = async (d: boolean) =>
  { try { await AsyncStorage.setItem(TK, d ? 'dark' : 'light'); } catch {} };

/* ─── Themes ─────────────────────────────────────────────────────────────── */
const DARK = {
  bg: '#090D1A', surf: '#111827', surf2: '#151D30', border: '#1E2A42',
  text: '#E6E9FF', muted: '#4E5878',
  player: '#5AB8FF', ai: '#FF506A',
  cell: '#162035', cellWin: '#0C1D38',
  btnPrimary: '#3B9FFF', shadow: '#000000',
};
const LIGHT = {
  bg: '#ECF0FF', surf: '#FFFFFF', surf2: '#EEF1FF', border: '#CDD6FF',
  text: '#0B1020', muted: '#667098',
  player: '#1874F5', ai: '#E5203C',
  cell: '#DDE4FF', cellWin:'#B8D4FF',
  btnPrimary: '#1874F5', shadow: '#8898CC',
};

/* ─── Component ──────────────────────────────────────────────────────────── */
const EB: Piece[] = Array(9).fill(null);

export default function XoClash() {
  const insets = useSafeAreaInsets();

  /* ── state ── */
  const [screen,   setScreen]   = useState<Scr>('menu');
  const [diff,     setDiff]     = useState<Diff>('medium');
  const [board,    setBoard]    = useState<Piece[]>([...EB]);
  const [pTurn,    setPTurn]    = useState(true);
  const [over,     setOver]     = useState(false);
  const [result,   setResult]   = useState<GRes>(null);
  const [session,  setSession]  = useState<Score>({ w:0, l:0, d:0 });
  const [streak,   setStreak]   = useState(0);
  const [thinking, setThinking] = useState(false);
  const [stats,    setStats]    = useState<Stats>(E0);
  const [dark,     setDark]     = useState(true);
  const [loaded,   setLoaded]   = useState(false);

  const theme: Theme = dark ? DARK : LIGHT;
  const dc = DIFFS[diff];

  /* ── animations ── */
  const cellA = useRef(Array.from({ length: 9 }, () => new Animated.Value(1))).current;
  const winA  = useRef(new Animated.Value(1)).current;
  const winL  = useRef<Animated.CompositeAnimation | null>(null);

  /* ── load persisted data ── */
  useEffect(() => {
    loadData().then(({ stats: s, dark: d }) => {
      setStats(s); setDark(d); setLoaded(true);
    });
  }, []);

  /* ── AI turn ── */
  useEffect(() => {
    if (pTurn || over || screen !== 'game') return;
    setThinking(true);
    const t = setTimeout(() => {
      const copy = [...board] as Piece[];
      const mv = getMove(copy, diff);
      if (mv !== -1) {
        copy[mv] = 'O';
        setBoard(copy);
        tapAnim(mv);
        const r = checkResult(copy);
        if (r) endGame(r); else setPTurn(true);
      }
      setThinking(false);
    }, dc.delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pTurn, over, screen]);

  /* ── helpers ── */
  function tapAnim(idx: number) {
    Animated.sequence([
      Animated.timing(cellA[idx], { toValue: 0.76, duration: 60, useNativeDriver: true }),
      Animated.spring(cellA[idx],  { toValue: 1, friction: 3, tension: 240, useNativeDriver: true }),
    ]).start();
  }

  function startWin() {
    winL.current = Animated.loop(Animated.sequence([
      Animated.timing(winA, { toValue: 1.13, duration: 370, useNativeDriver: true }),
      Animated.timing(winA, { toValue: 0.89, duration: 370, useNativeDriver: true }),
    ]));
    winL.current.start();
  }

  function stopWin() { winL.current?.stop(); winA.setValue(1); }

  function endGame(r: GRes) {
    setResult(r); setOver(true);
    if (r?.winner !== 'draw') startWin();
    setSession(p => ({
      w: p.w + (r?.winner === 'X' ? 1 : 0),
      l: p.l + (r?.winner === 'O' ? 1 : 0),
      d: p.d + (r?.winner === 'draw' ? 1 : 0),
    }));
    setStreak(s => (r?.winner === 'X' ? s + 1 : 0));
    setStats(prev => {
      const next: Stats = JSON.parse(JSON.stringify(prev));
      if      (r?.winner === 'X')    next[diff].w++;
      else if (r?.winner === 'O')    next[diff].l++;
      else if (r?.winner === 'draw') next[diff].d++;
      if (loaded) saveStats(next);
      return next;
    });
  }

  function pressCell(idx: number) {
    if (!pTurn || board[idx] || over || thinking) return;
    const next = [...board] as Piece[];
    next[idx] = 'X';
    setBoard(next); tapAnim(idx);
    const r = checkResult(next);
    if (r) endGame(r); else setPTurn(false);
  }

  function newGame() {
    stopWin();
    setBoard([...EB]); setPTurn(true); setOver(false);
    setResult(null); setThinking(false);
    cellA.forEach(a => a.setValue(1));
  }

  function goMenu() {
    stopWin(); setScreen('menu');
    setBoard([...EB]); setPTurn(true); setOver(false);
    setResult(null); setThinking(false);
    setSession({ w:0, l:0, d:0 }); setStreak(0);
    cellA.forEach(a => a.setValue(1));
  }

  function pickDiff(d: Diff) {
    setDiff(d); stopWin();
    setBoard([...EB]); setPTurn(true); setOver(false);
    setResult(null); setThinking(false);
    setSession({ w:0, l:0, d:0 }); setStreak(0);
    cellA.forEach(a => a.setValue(1));
    setScreen('game');
  }

  function toggleDark() { setDark(d => { saveTheme(!d); return !d; }); }

  function confirmReset() {
    Alert.alert(
      'Reset All Stats?',
      'Clears wins, losses, and draws for all difficulties.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress() { setStats(E0); saveStats(E0); } },
      ]
    );
  }

  /* ── status text ── */
  let stTxt: string, stClr: string;
  if (over && result) {
    if      (result.winner === 'X')    { stTxt = streak >= 3 ? `🔥 ${streak} wins in a row!` : 'You win! 🎉'; stClr = theme.player; }
    else if (result.winner === 'O')    { stTxt = `${dc.emoji} ${dc.label} wins 😈`;                            stClr = theme.ai; }
    else                               { stTxt = "It's a draw 🤝";                                             stClr = theme.muted; }
  } else if (thinking) {               stTxt = dc.thinking;                                                    stClr = dc.color; }
  else {                               stTxt = 'Your turn  –  X';                                              stClr = theme.player; }

  const s = mkStyles(theme);

  /* ════════════════════════════════════════════════════════════════════
     MENU SCREEN
  ════════════════════════════════════════════════════════════════════ */
  if (screen === 'menu') {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.bg }}
        contentContainerStyle={[s.menuRoot, { paddingTop: insets.top + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />

        {/* ── title row ── */}
        <View style={s.menuHead}>
          <View>
            <Text style={s.menuTitle}>XO Clash</Text>
            <Text style={s.menuSub}>Pick your challenge</Text>
          </View>
          <TouchableOpacity style={s.pill} onPress={toggleDark} activeOpacity={0.72}>
            <Text style={s.pillTxt}>{dark ? '🌞' : '🌙'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── difficulty cards ── */}
        {(['easy', 'medium', 'hard'] as Diff[]).map(d => {
          const cfg  = DIFFS[d];
          const st   = stats[d];
          const tot  = st.w + st.l + st.d;
          const wPct = tot > 0 ? Math.round((st.w / tot) * 100) : null;
          return (
            <TouchableOpacity
              key={d}
              style={[s.diffCard, { borderColor: cfg.color + '60' }]}
              onPress={() => pickDiff(d)}
              activeOpacity={0.8}
            >
              {/* left: emoji box + text */}
              <View style={s.diffLeft}>
                <View style={[s.diffIcon, { backgroundColor: cfg.color + '22' }]}>
                  <Text style={s.diffEmoji}>{cfg.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.diffLabel, { color: cfg.color }]}>{cfg.label}</Text>
                  <Text style={[s.diffDesc,  { color: theme.muted }]}>{cfg.desc}</Text>
                </View>
              </View>

              {/* right: win % or "NEW" */}
              <View style={s.diffRight}>
                {wPct !== null ? (
                  <>
                    <Text style={[s.diffPct,    { color: cfg.color }]}>{wPct}%</Text>
                    <Text style={[s.diffPctSub, { color: theme.muted }]}>win</Text>
                  </>
                ) : (
                  <Text style={[s.diffNew, { color: theme.muted }]}>NEW</Text>
                )}
                <Text style={[s.diffArrow, { color: cfg.color }]}>›</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* ── all-time mini stats ── */}
        <View style={s.miniRow}>
          {(['easy', 'medium', 'hard'] as Diff[]).map(d => {
            const { w, l, d: dr } = stats[d];
            return (
              <View key={d} style={[s.miniBox, { borderColor: DIFFS[d].color + '40' }]}>
                <Text style={s.miniEmoji}>{DIFFS[d].emoji}</Text>
                <Text style={[s.miniW,   { color: theme.player }]}>{w}W</Text>
                <Text style={[s.miniSep, { color: theme.muted }]}>·</Text>
                <Text style={[s.miniL,   { color: theme.ai }]}>{l}L</Text>
                <Text style={[s.miniSep, { color: theme.muted }]}>·</Text>
                <Text style={[s.miniD,   { color: theme.muted }]}>{dr}D</Text>
              </View>
            );
          })}
        </View>

        <TouchableOpacity onPress={confirmReset} style={s.resetBtn}>
          <Text style={[s.resetTxt, { color: theme.muted }]}>Reset all stats</Text>
        </TouchableOpacity>

        <Text style={[s.footer, { color: theme.muted }]}>
          No permissions required  ·  Fully offline
        </Text>
      </ScrollView>
    );
  }

  /* ════════════════════════════════════════════════════════════════════
     GAME SCREEN
  ════════════════════════════════════════════════════════════════════ */
  return (
    <View style={[s.gameRoot, { paddingTop: insets.top + 10 }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />

      {/* ── header ── */}
      <View style={s.gameHead}>
        <TouchableOpacity style={s.pill} onPress={goMenu} activeOpacity={0.72}>
          <Text style={[s.pillTxt, s.backTxt]}>← Menu</Text>
        </TouchableOpacity>

        <View style={[s.badge, { backgroundColor: dc.color + '22', borderColor: dc.color }]}>
          <Text style={[s.badgeTxt, { color: dc.color }]}>{dc.emoji}  {dc.label}</Text>
        </View>

        <TouchableOpacity style={s.pill} onPress={toggleDark} activeOpacity={0.72}>
          <Text style={s.pillTxt}>{dark ? '🌞' : '🌙'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── session score ── */}
      <View style={s.scoreCard}>
        <View style={s.scoreCol}>
          <Text style={[s.scoreLbl, { color: theme.player }]}>YOU</Text>
          <Text style={[s.scoreNum, { color: theme.player }]}>{session.w}</Text>
        </View>
        <View style={s.scoreSep} />
        <View style={s.scoreCol}>
          <Text style={[s.scoreLbl, { color: theme.muted }]}>DRAW</Text>
          <Text style={[s.scoreNum, { color: theme.muted }]}>{session.d}</Text>
        </View>
        <View style={s.scoreSep} />
        <View style={s.scoreCol}>
          <Text style={[s.scoreLbl, { color: theme.ai }]}>AI</Text>
          <Text style={[s.scoreNum, { color: theme.ai }]}>{session.l}</Text>
        </View>
        {streak >= 2 && (
          <View style={s.streakBadge}>
            <Text style={s.streakTxt}>🔥 {streak}</Text>
          </View>
        )}
      </View>

      {/* ── status ── */}
      <View style={s.statusBox}>
        <Text style={[s.statusTxt, { color: stClr }]}>{stTxt}</Text>
      </View>

      {/* ── board ── */}
      <View style={s.boardCard}>
        {[0, 1, 2].map(row => (
          <View key={row} style={s.boardRow}>
            {[0, 1, 2].map(col => {
              const idx    = row * 3 + col;
              const cell   = board[idx];
              const isWin  = result?.line?.includes(idx) ?? false;
              const wClr   = result?.winner === 'O' ? theme.ai : theme.player;
              const animSc = isWin ? winA : cellA[idx];
              return (
                <Animated.View key={col} style={{ transform: [{ scale: animSc }] }}>
                  <TouchableOpacity
                    style={[
                      s.cell,
                      isWin && { backgroundColor: theme.cellWin, borderColor: wClr, borderWidth: 2.5 },
                    ]}
                    onPress={() => pressCell(idx)}
                    activeOpacity={0.65}
                  >
                    {cell ? (
                      <Text style={[s.sym, { color: cell === 'X' ? theme.player : theme.ai }]}>
                        {cell}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        ))}
      </View>

      {/* ── new game button ── */}
      <TouchableOpacity
        style={[s.newBtn, { backgroundColor: theme.btnPrimary }]}
        onPress={newGame}
        activeOpacity={0.82}
      >
        <Text style={s.newBtnTxt}>New Game</Text>
      </TouchableOpacity>

      {/* ── difficulty switcher ── */}
      <View style={s.diffSwitchRow}>
        {(['easy', 'medium', 'hard'] as Diff[]).map(d => (
          <TouchableOpacity
            key={d}
            style={[
              s.diffChip,
              { borderColor: DIFFS[d].color + (diff === d ? 'FF' : '40') },
              diff === d && { backgroundColor: DIFFS[d].color + '22' },
            ]}
            onPress={() => pickDiff(d)}
            activeOpacity={0.75}
          >
            <Text style={[s.diffChipTxt, { color: diff === d ? DIFFS[d].color : theme.muted }]}>
              {DIFFS[d].emoji}  {DIFFS[d].label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[s.footer, { color: theme.muted, marginTop: 8 }]}>
        No permissions  ·  Fully offline
      </Text>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
function mkStyles(t: Theme) {
  return StyleSheet.create({
    /* ── Menu ── */
    menuRoot: {
      alignItems: 'center', paddingHorizontal: HP, paddingBottom: 40,
      backgroundColor: t.bg,
    },
    menuHead: {
      width: '100%', flexDirection: 'row',
      alignItems: 'center', justifyContent: 'space-between', marginBottom: 28,
    },
    menuTitle: { fontSize: 38, fontWeight: '900', color: t.text, letterSpacing: 2 },
    menuSub:   { fontSize: 14, color: t.muted, marginTop: 3, letterSpacing: 0.4 },

    diffCard: {
      width: '100%', flexDirection: 'row', alignItems: 'center',
      backgroundColor: t.surf, borderRadius: 20, padding: 16,
      borderWidth: 1.5, marginBottom: 12,
      shadowColor: t.shadow, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.14, shadowRadius: 8, elevation: 5,
    },
    diffLeft:   { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    diffIcon:   { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    diffEmoji:  { fontSize: 26 },
    diffLabel:  { fontSize: 15, fontWeight: '900', letterSpacing: 1, marginBottom: 3 },
    diffDesc:   { fontSize: 12, fontWeight: '500', lineHeight: 18 },
    diffRight:  { alignItems: 'center', gap: 1, paddingLeft: 8 },
    diffPct:    { fontSize: 22, fontWeight: '900' },
    diffPctSub: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
    diffNew:    { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
    diffArrow:  { fontSize: 24, marginTop: 2 },

    miniRow: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 20, width: '100%' },
    miniBox: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 4, backgroundColor: t.surf2, borderRadius: 12, paddingVertical: 10,
      borderWidth: 1,
    },
    miniEmoji: { fontSize: 14 },
    miniW:     { fontSize: 11, fontWeight: '800' },
    miniL:     { fontSize: 11, fontWeight: '800' },
    miniD:     { fontSize: 11, fontWeight: '600' },
    miniSep:   { fontSize: 11 },

    resetBtn: { marginBottom: 14 },
    resetTxt: { fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
    footer:   { fontSize: 11, letterSpacing: 0.6 },

    /* ── Shared ── */
    pill: {
      backgroundColor: t.surf, borderRadius: 22,
      paddingHorizontal: 12, paddingVertical: 8,
      shadowColor: t.shadow, shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15, shadowRadius: 5, elevation: 3,
    },
    pillTxt: { fontSize: 20 },
    backTxt: { fontSize: 14, color: t.text, fontWeight: '600' },

    /* ── Game ── */
    gameRoot: {
      flex: 1, backgroundColor: t.bg,
      alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: HP,
    },
    gameHead: {
      width: '100%', flexDirection: 'row',
      alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
    },
    badge: {
      borderRadius: 14, borderWidth: 1.5,
      paddingHorizontal: 12, paddingVertical: 6,
    },
    badgeTxt: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },

    scoreCard: {
      width: '100%', flexDirection: 'row', alignItems: 'center',
      backgroundColor: t.surf, borderRadius: 18,
      paddingVertical: 14, paddingHorizontal: 8, marginBottom: 14,
      position: 'relative',
      shadowColor: t.shadow, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12, shadowRadius: 10, elevation: 5,
    },
    scoreCol: { flex: 1, alignItems: 'center' },
    scoreSep: { width: 1, height: 32, backgroundColor: t.border },
    scoreLbl: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 3 },
    scoreNum: { fontSize: 28, fontWeight: '900' },

    streakBadge: {
      position: 'absolute', right: 10, top: -12,
      backgroundColor: '#FF6A1A', borderRadius: 10,
      paddingHorizontal: 8, paddingVertical: 3,
    },
    streakTxt: { color: '#FFF', fontSize: 12, fontWeight: '800' },

    statusBox: { height: 30, justifyContent: 'center', marginBottom: 12 },
    statusTxt: { fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },

    boardCard: {
      backgroundColor: t.surf, borderRadius: 22, padding: CP, gap: CG,
      shadowColor: t.shadow, shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.20, shadowRadius: 16, elevation: 10, marginBottom: 18,
    },
    boardRow: { flexDirection: 'row', gap: CG },
    cell: {
      width: CS, height: CS, backgroundColor: t.cell, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: t.shadow, shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
    },
    sym: {
      fontSize: Math.floor(CS * 0.54),
      fontWeight: '900',
      includeFontPadding: false,
      lineHeight: Math.floor(CS * 0.64),
    },

    newBtn: {
      width: '100%', paddingVertical: 14, borderRadius: 14,
      alignItems: 'center', marginBottom: 12,
      shadowColor: t.shadow, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25, shadowRadius: 8, elevation: 6,
    },
    newBtnTxt: { color: '#FFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },

    diffSwitchRow: { flexDirection: 'row', gap: 8, width: '100%' },
    diffChip: {
      flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5,
      alignItems: 'center',
    },
    diffChipTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  });
}
