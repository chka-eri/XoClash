import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
  Dimensions,
  ScrollView,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
  interpolate,
  SharedValue,
  FadeIn,
  FadeOut,
  BounceIn,
  ZoomIn,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

/* ─── Board geometry ──────────────────────────────────────────────────────── */
const { width: SW } = Dimensions.get('window');
const HP = 20;
const CP = 12;
const CG = 8;
const BOARD_W = Math.min(SW - (HP + CP) * 2, 308);
const CS = Math.floor((BOARD_W - CG * 2) / 3);

/* ─── Types ──────────────────────────────────────────────────────────────── */
type Piece = 'X' | 'O' | null;
type Diff = 'easy' | 'medium' | 'hard';
type Score = { w: number; l: number; d: number };
type Stats = Record<Diff, Score>;
type GRes = { winner: string; line: number[] } | null;
type Scr = 'menu' | 'game';
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
    color: '#00E676', delay: 260,
  },
  medium: {
    emoji: '⚡', label: 'VETERAN',
    desc: 'AI blocks & attacks. Stay sharp.',
    thinking: 'Veteran is plotting… ⚡',
    color: '#FFD600', delay: 500,
  },
  hard: {
    emoji: '💀', label: 'LEGEND',
    desc: 'Unbeatable AI. A draw is glory.',
    thinking: 'Legend sees all futures… 💀',
    color: '#FF1744', delay: 640,
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
  for (let i = 0; i < 9; i++) {
    if (!b[i]) { b[i] = 'O'; const r = checkResult(b); b[i] = null; if (r?.winner === 'O') return i; }
  }
  for (let i = 0; i < 9; i++) {
    if (!b[i]) { b[i] = 'X'; const r = checkResult(b); b[i] = null; if (r?.winner === 'X') return i; }
  }
  if (!b[4]) return 4;
  const corners = [0, 2, 6, 8].filter(i => !b[i]);
  if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
  return randOf(b);
}

function getMove(b: Piece[], diff: Diff): number {
  if (diff === 'easy') return randOf(b);
  if (diff === 'medium') return mediumMove(b);
  return hardMove(b);
}

/* ─── Storage ────────────────────────────────────────────────────────────── */
const SK = '@xoclash3:stats';
const TK = '@xoclash3:theme';
const E0: Stats = { easy: { w: 0, l: 0, d: 0 }, medium: { w: 0, l: 0, d: 0 }, hard: { w: 0, l: 0, d: 0 } };

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
  bg: '#070B17',
  surf: 'rgba(17, 24, 39, 0.65)',
  surf2: 'rgba(21, 29, 48, 0.45)',
  border: 'rgba(255, 255, 255, 0.06)',
  text: '#E6E9FF',
  muted: '#5C6794',
  player: '#00D4FF',
  ai: '#FF2D55',
  cell: 'rgba(22, 32, 53, 0.55)',
  cellWin: 'rgba(0, 212, 255, 0.12)',
  btnPrimary: '#2979FF',
  shadow: '#000000',
  glowX: 'rgba(0, 212, 255, 0.7)',
  glowO: 'rgba(255, 45, 85, 0.7)',
};
const LIGHT = {
  bg: '#ECF0FF',
  surf: 'rgba(255, 255, 255, 0.78)',
  surf2: 'rgba(238, 241, 255, 0.7)',
  border: 'rgba(0, 0, 0, 0.06)',
  text: '#0B1020',
  muted: '#667098',
  player: '#0066FF',
  ai: '#E5203C',
  cell: 'rgba(221, 228, 255, 0.7)',
  cellWin: 'rgba(0, 102, 255, 0.12)',
  btnPrimary: '#0066FF',
  shadow: '#8898CC',
  glowX: 'rgba(0, 102, 255, 0.5)',
  glowO: 'rgba(229, 32, 60, 0.5)',
};

/* ─── Confetti celebration ───────────────────────────────────────────────── */
const CONFETTI_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#F7DC6F', '#BB8FCE', '#85C1E9', '#FF9FF3'];

function Confetti() {
  const pieces = useMemo(() =>
    Array.from({ length: 28 }, (_, i) => ({
      x: (SW / 28) * i + (Math.random() - 0.5) * 30,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 5 + (i % 5) * 2,
      delay: (i % 7) * 50 + Math.random() * 150,
    })), []
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map(p => (
        <Animated.View
          key={p.x}
          entering={ZoomIn.duration(400).delay(p.delay).springify().damping(8)}
          exiting={FadeOut.duration(200)}
          style={{
            position: 'absolute',
            top: -10,
            left: p.x,
            width: p.size,
            height: p.size,
            borderRadius: Math.round(p.size / 2),
            backgroundColor: p.color,
            shadowColor: p.color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 6,
            elevation: 4,
          }}
        />
      ))}
    </View>
  );
}

/* ─── Animated score number ──────────────────────────────────────────────── */
function AnimatedNumber({ value, style }: { value: number; style?: any }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSequence(
      withSpring(1.35, { damping: 2, stiffness: 200 }),
      withSpring(1, { damping: 4, stiffness: 150 })
    );
  }, [value]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <Animated.Text style={[style, animStyle]}>{value}</Animated.Text>;
}

/* ─── Animated background aurora ─────────────────────────────────────────── */
function AuroraBackground({ theme }: { theme: Theme }) {
  const dx1 = useSharedValue(0);
  const dy1 = useSharedValue(0);
  const dx2 = useSharedValue(0);
  const dy2 = useSharedValue(0);
  const dx3 = useSharedValue(0);
  const dy3 = useSharedValue(0);

  useEffect(() => {
    const dur = (base: number) => ({ duration: base, easing: Easing.inOut(Easing.sin) as any });
    dx1.value = withRepeat(withSequence(withTiming(50, dur(6000)), withTiming(-50, dur(6000))), -1, true);
    dy1.value = withRepeat(withSequence(withTiming(30, dur(7000)), withTiming(-30, dur(7000))), -1, true);
    dx2.value = withRepeat(withSequence(withTiming(-40, dur(8000)), withTiming(40, dur(8000))), -1, true);
    dy2.value = withRepeat(withSequence(withTiming(-20, dur(5000)), withTiming(20, dur(5000))), -1, true);
    dx3.value = withRepeat(withSequence(withTiming(25, dur(9000)), withTiming(-25, dur(9000))), -1, true);
    dy3.value = withRepeat(withSequence(withTiming(-35, dur(6500)), withTiming(35, dur(6500))), -1, true);
  }, []);

  const a1 = useAnimatedStyle(() => ({ transform: [{ translateX: dx1.value }, { translateY: dy1.value }] }));
  const a2 = useAnimatedStyle(() => ({ transform: [{ translateX: dx2.value }, { translateY: dy2.value }] }));
  const a3 = useAnimatedStyle(() => ({ transform: [{ translateX: dx3.value }, { translateY: dy3.value }] }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[{
          position: 'absolute',
          width: 280, height: 280, borderRadius: 140,
          backgroundColor: theme.player + '0A',
          top: -100, left: -80,
        }, a1]}
      />
      <Animated.View
        style={[{
          position: 'absolute',
          width: 220, height: 220, borderRadius: 110,
          backgroundColor: theme.ai + '08',
          bottom: 40, right: -60,
        }, a2]}
      />
      <Animated.View
        style={[{
          position: 'absolute',
          width: 190, height: 190, borderRadius: 95,
          backgroundColor: '#FFD60006',
          top: '35%', left: '25%',
        }, a3]}
      />
    </View>
  );
}

/* ─── Animated cell wrapper ──────────────────────────────────────────────── */
function CellView({ sv, children }: { sv: SharedValue<number>; children: React.ReactNode }) {
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sv.value }],
    opacity: interpolate(sv.value, [0.76, 1], [0.85, 1]),
  }));
  return <Animated.View style={animStyle}>{children}</Animated.View>;
}

/* ─── Animated glow overlay for win ──────────────────────────────────────── */
function WinPulse({ color }: { color: string }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.3, { duration: 600, easing: Easing.inOut(Easing.sin) })
      ),
      -1, true
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, style, {
        backgroundColor: color + '18',
        borderRadius: 22,
      }]}
      pointerEvents="none"
    />
  );
}

/* ─── Component ──────────────────────────────────────────────────────────── */
const EB: Piece[] = Array(9).fill(null);

export default function XoClash() {
  const insets = useSafeAreaInsets();

  /* ── state ── */
  const [screen, setScreen] = useState<Scr>('menu');
  const [diff, setDiff] = useState<Diff>('medium');
  const [board, setBoard] = useState<Piece[]>([...EB]);
  const [pTurn, setPTurn] = useState(true);
  const [over, setOver] = useState(false);
  const [result, setResult] = useState<GRes>(null);
  const [session, setSession] = useState<Score>({ w: 0, l: 0, d: 0 });
  const [streak, setStreak] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [stats, setStats] = useState<Stats>(E0);
  const [dark, setDark] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const theme: Theme = dark ? DARK : LIGHT;
  const dc = DIFFS[diff];

  /* ── reanimated shared values ── */
  const cellSv = useMemo(() => Array.from({ length: 9 }, () => useSharedValue(1)), []);
  const winSv = useSharedValue(1);
  const winGlowOpacity = useSharedValue(0);
  const celebrateKey = useRef(0);

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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
    cellSv[idx].value = withSequence(
      withTiming(0.78, { duration: 50 }),
      withSpring(1, { damping: 4, stiffness: 200 })
    );
  }

  function startWin() {
    winSv.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 350, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.92, { duration: 350, easing: Easing.inOut(Easing.sin) })
      ),
      -1, true
    );
    winGlowOpacity.value = withTiming(1, { duration: 300 });
  }

  function stopWin() {
    winSv.value = 1;
    winGlowOpacity.value = withTiming(0, { duration: 200 });
  }

  function endGame(r: GRes) {
    setResult(r); setOver(true);
    celebrateKey.current++;
    if (r?.winner !== 'draw') {
      startWin();
      Haptics.notificationAsync(
        r?.winner === 'X'
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error
      );
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    setSession(p => ({
      w: p.w + (r?.winner === 'X' ? 1 : 0),
      l: p.l + (r?.winner === 'O' ? 1 : 0),
      d: p.d + (r?.winner === 'draw' ? 1 : 0),
    }));
    setStreak(s => (r?.winner === 'X' ? s + 1 : 0));
    setStats(prev => {
      const next: Stats = JSON.parse(JSON.stringify(prev));
      if (r?.winner === 'X') next[diff].w++;
      else if (r?.winner === 'O') next[diff].l++;
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const r = checkResult(next);
    if (r) endGame(r); else setPTurn(false);
  }

  function newGame() {
    stopWin();
    setBoard([...EB]); setPTurn(true); setOver(false);
    setResult(null); setThinking(false);
    cellSv.forEach(sv => { sv.value = 1; });
  }

  function goMenu() {
    stopWin(); setScreen('menu');
    setBoard([...EB]); setPTurn(true); setOver(false);
    setResult(null); setThinking(false);
    setSession({ w: 0, l: 0, d: 0 }); setStreak(0);
    cellSv.forEach(sv => { sv.value = 1; });
  }

  function pickDiff(d: Diff) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDiff(d); stopWin();
    setBoard([...EB]); setPTurn(true); setOver(false);
    setResult(null); setThinking(false);
    setSession({ w: 0, l: 0, d: 0 }); setStreak(0);
    cellSv.forEach(sv => { sv.value = 1; });
    setScreen('game');
  }

  function toggleDark() { setDark(d => { saveTheme(!d); return !d; }); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }

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
    if (result.winner === 'X') { stTxt = streak >= 3 ? `🔥 ${streak} wins in a row!` : 'You win! 🎉'; stClr = theme.player; }
    else if (result.winner === 'O') { stTxt = `${dc.emoji} ${dc.label} wins 😈`; stClr = theme.ai; }
    else { stTxt = "It's a draw 🤝"; stClr = theme.muted; }
  } else if (thinking) { stTxt = dc.thinking; stClr = dc.color; }
  else { stTxt = 'Your turn  –  X'; stClr = theme.player; }

  const winColor = result?.winner === 'O' ? theme.ai : result?.winner === 'X' ? theme.player : theme.muted;

  const s = mkStyles(theme);

  /* ════════════════════════════════════════════════════════════════════
     MENU SCREEN
  ════════════════════════════════════════════════════════════════════ */
  if (screen === 'menu') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <AuroraBackground theme={theme} />
        <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.menuRoot, { paddingTop: insets.top + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── title row ── */}
          <View style={s.menuHead}>
            <View>
              <Text style={s.menuTitle}>XO Clash</Text>
              <Text style={s.menuSub}>Pick your challenge</Text>
            </View>
            <TouchableOpacity style={s.pill} onPress={toggleDark} activeOpacity={0.72}>
              <Text style={s.pillTxt}>{dark ? '☀️' : '🌙'}</Text>
            </TouchableOpacity>
          </View>

          {/* ── difficulty cards ── */}
          {(['easy', 'medium', 'hard'] as Diff[]).map(d => {
            const cfg = DIFFS[d];
            const st = stats[d];
            const tot = st.w + st.l + st.d;
            const wPct = tot > 0 ? Math.round((st.w / tot) * 100) : null;
            return (
              <TouchableOpacity
                key={d}
                style={[s.diffCard, { borderColor: cfg.color + '50' }]}
                onPress={() => pickDiff(d)}
                activeOpacity={0.85}
              >
                <View style={s.diffLeft}>
                  <View style={[s.diffIcon, { backgroundColor: cfg.color + '18' }]}>
                    <View style={[s.diffGlow, { backgroundColor: cfg.color + '30' }]} />
                    <Text style={s.diffEmoji}>{cfg.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.diffLabel, { color: cfg.color }]}>{cfg.label}</Text>
                    <Text style={[s.diffDesc, { color: theme.muted }]}>{cfg.desc}</Text>
                  </View>
                </View>
                <View style={s.diffRight}>
                  {wPct !== null ? (
                    <>
                      <Text style={[s.diffPct, { color: cfg.color }]}>{wPct}%</Text>
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
                <View key={d} style={[s.miniBox, { borderColor: DIFFS[d].color + '30' }]}>
                  <Text style={s.miniEmoji}>{DIFFS[d].emoji}</Text>
                  <Text style={[s.miniW, { color: theme.player }]}>{w}W</Text>
                  <Text style={[s.miniSep, { color: theme.muted }]}>·</Text>
                  <Text style={[s.miniL, { color: theme.ai }]}>{l}L</Text>
                  <Text style={[s.miniSep, { color: theme.muted }]}>·</Text>
                  <Text style={[s.miniD, { color: theme.muted }]}>{dr}D</Text>
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
      </View>
    );
  }

  /* ════════════════════════════════════════════════════════════════════
     GAME SCREEN
  ════════════════════════════════════════════════════════════════════ */
  return (
    <View style={[s.gameRoot, { paddingTop: insets.top + 10 }]}>
      <AuroraBackground theme={theme} />
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />

      {/* ── header ── */}
      <View style={s.gameHead}>
        <TouchableOpacity style={s.pill} onPress={goMenu} activeOpacity={0.72}>
          <Text style={[s.pillTxt, s.backTxt]}>← Menu</Text>
        </TouchableOpacity>

        <View style={[s.badge, { backgroundColor: dc.color + '18', borderColor: dc.color }]}>
          <Text style={[s.badgeTxt, { color: dc.color }]}>{dc.emoji}  {dc.label}</Text>
        </View>

        <TouchableOpacity style={s.pill} onPress={toggleDark} activeOpacity={0.72}>
          <Text style={s.pillTxt}>{dark ? '☀️' : '🌙'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── session score ── */}
      <View style={s.scoreCard}>
        <View style={s.scoreCol}>
          <Text style={[s.scoreLbl, { color: theme.player }]}>YOU</Text>
          <AnimatedNumber value={session.w} style={[s.scoreNum, { color: theme.player }]} />
        </View>
        <View style={s.scoreSep} />
        <View style={s.scoreCol}>
          <Text style={[s.scoreLbl, { color: theme.muted }]}>DRAW</Text>
          <AnimatedNumber value={session.d} style={[s.scoreNum, { color: theme.muted }]} />
        </View>
        <View style={s.scoreSep} />
        <View style={s.scoreCol}>
          <Text style={[s.scoreLbl, { color: theme.ai }]}>AI</Text>
          <AnimatedNumber value={session.l} style={[s.scoreNum, { color: theme.ai }]} />
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
        {over && result?.winner !== 'draw' && <WinPulse color={winColor} />}
        {over && result?.winner !== 'draw' && result && <Confetti key={celebrateKey.current} />}
        {[0, 1, 2].map(row => (
          <View key={row} style={s.boardRow}>
            {[0, 1, 2].map(col => {
              const idx = row * 3 + col;
              const cell = board[idx];
              const isWin = result?.line?.includes(idx) ?? false;
              const wClr = result?.winner === 'O' ? theme.ai : theme.player;
              return (
                <CellView key={col} sv={isWin ? winSv : cellSv[idx]}>
                  <TouchableOpacity
                    style={[
                      s.cell,
                      isWin && { backgroundColor: theme.cellWin, borderColor: wClr, borderWidth: 2 },
                    ]}
                    onPress={() => pressCell(idx)}
                    activeOpacity={0.65}
                    disabled={over || thinking || !pTurn}
                  >
                    {cell ? (
                      <Text style={[
                        s.sym,
                        { color: cell === 'X' ? theme.player : theme.ai },
                        cell === 'X' ? { textShadowColor: theme.glowX, textShadowRadius: Platform.OS === 'web' ? 0 : 10, textShadowOffset: { width: 0, height: 0 } }
                          : { textShadowColor: theme.glowO, textShadowRadius: Platform.OS === 'web' ? 0 : 10, textShadowOffset: { width: 0, height: 0 } },
                      ]}>
                        {cell}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                </CellView>
              );
            })}
          </View>
        ))}
      </View>

      {/* ── new game button ── */}
      <TouchableOpacity
        style={[s.newBtn, { backgroundColor: theme.btnPrimary }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); newGame(); }}
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
              diff === d && { backgroundColor: DIFFS[d].color + '18' },
              diff === d && { borderColor: DIFFS[d].color },
              diff !== d && { borderColor: theme.border },
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
const GLASS = {
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.07)',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.25,
  shadowRadius: 20,
  elevation: 12,
  overflow: 'hidden' as const,
};

function mkStyles(t: Theme) {
  return StyleSheet.create({
    /* ── Menu ── */
    menuRoot: {
      alignItems: 'center', paddingHorizontal: HP, paddingBottom: 40,
    },
    menuHead: {
      width: '100%', flexDirection: 'row',
      alignItems: 'center', justifyContent: 'space-between', marginBottom: 28,
    },
    menuTitle: { fontSize: 38, fontWeight: '900', color: t.text, letterSpacing: 1.5 },
    menuSub: { fontSize: 14, color: t.muted, marginTop: 3, letterSpacing: 0.4 },

    diffCard: {
      width: '100%', flexDirection: 'row', alignItems: 'center',
      backgroundColor: t.surf,
      borderRadius: 20, padding: 16,
      marginBottom: 12,
      ...GLASS,
    },
    diffLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    diffIcon: {
      width: 50, height: 50, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    },
    diffGlow: {
      position: 'absolute', width: '100%', height: '100%',
      borderRadius: 14, opacity: 0.3,
    },
    diffEmoji: { fontSize: 26 },
    diffLabel: { fontSize: 15, fontWeight: '900', letterSpacing: 1, marginBottom: 3 },
    diffDesc: { fontSize: 12, fontWeight: '500', lineHeight: 18 },
    diffRight: { alignItems: 'center', gap: 1, paddingLeft: 8 },
    diffPct: { fontSize: 22, fontWeight: '900' },
    diffPctSub: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
    diffNew: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
    diffArrow: { fontSize: 24, marginTop: 2 },

    miniRow: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 20, width: '100%' },
    miniBox: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 4, backgroundColor: t.surf2, borderRadius: 12, paddingVertical: 10,
      borderWidth: 1,
    },
    miniEmoji: { fontSize: 14 },
    miniW: { fontSize: 11, fontWeight: '800' },
    miniL: { fontSize: 11, fontWeight: '800' },
    miniD: { fontSize: 11, fontWeight: '600' },
    miniSep: { fontSize: 11 },

    resetBtn: { marginBottom: 14 },
    resetTxt: { fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
    footer: { fontSize: 11, letterSpacing: 0.6 },

    /* ── Shared ── */
    pill: {
      backgroundColor: t.surf,
      borderRadius: 22,
      paddingHorizontal: 12, paddingVertical: 8,
      borderWidth: 1,
      borderColor: t.border,
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
      zIndex: 10,
    },
    badge: {
      borderRadius: 14, borderWidth: 1.5,
      paddingHorizontal: 12, paddingVertical: 6,
    },
    badgeTxt: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },

    scoreCard: {
      width: '100%', flexDirection: 'row', alignItems: 'center',
      backgroundColor: t.surf,
      borderRadius: 18,
      paddingVertical: 14, paddingHorizontal: 8, marginBottom: 14,
      position: 'relative',
      ...GLASS,
    },
    scoreCol: { flex: 1, alignItems: 'center' },
    scoreSep: { width: 1, height: 32, backgroundColor: t.border },
    scoreLbl: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 3 },
    scoreNum: { fontSize: 28, fontWeight: '900' },

    streakBadge: {
      position: 'absolute', right: 10, top: -12,
      backgroundColor: '#FF6A1A', borderRadius: 10,
      paddingHorizontal: 8, paddingVertical: 3,
      shadowColor: '#FF6A1A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 4,
    },
    streakTxt: { color: '#FFF', fontSize: 12, fontWeight: '800' },

    statusBox: { height: 30, justifyContent: 'center', marginBottom: 12, zIndex: 10 },
    statusTxt: { fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },

    boardCard: {
      backgroundColor: t.surf,
      borderRadius: 22, padding: CP, gap: CG,
      position: 'relative',
      ...GLASS,
    },
    boardRow: { flexDirection: 'row', gap: CG },
    cell: {
      width: CS, height: CS, backgroundColor: t.cell, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.border,
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
      shadowColor: t.btnPrimary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 6,
      zIndex: 10,
    },
    newBtnTxt: { color: '#FFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },

    diffSwitchRow: { flexDirection: 'row', gap: 8, width: '100%', zIndex: 10 },
    diffChip: {
      flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5,
      alignItems: 'center',
      backgroundColor: t.surf,
    },
    diffChipTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  });
}
