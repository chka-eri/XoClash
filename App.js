import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PLAYER = 'X';
const AI = 'O';
const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];
const SCORE_KEY = 'xo_clash_scores_v1';

const INITIAL_SCORES = {
  playerWins: 0,
  aiWins: 0,
  draws: 0,
};

const getWinner = (board) => {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a, b, c] };
    }
  }
  return { winner: null, line: [] };
};

const isBoardFull = (board) => board.every((cell) => cell !== null);

const minimax = (board, depth, isMaximizing) => {
  const { winner } = getWinner(board);

  if (winner === AI) return 10 - depth;
  if (winner === PLAYER) return depth - 10;
  if (isBoardFull(board)) return 0;

  if (isMaximizing) {
    let bestScore = -Infinity;
    for (let i = 0; i < board.length; i += 1) {
      if (board[i] === null) {
        board[i] = AI;
        const score = minimax(board, depth + 1, false);
        board[i] = null;
        bestScore = Math.max(bestScore, score);
      }
    }
    return bestScore;
  }

  let bestScore = Infinity;
  for (let i = 0; i < board.length; i += 1) {
    if (board[i] === null) {
      board[i] = PLAYER;
      const score = minimax(board, depth + 1, true);
      board[i] = null;
      bestScore = Math.min(bestScore, score);
    }
  }
  return bestScore;
};

const getBestMove = (board) => {
  let bestScore = -Infinity;
  let move = null;

  for (let i = 0; i < board.length; i += 1) {
    if (board[i] === null) {
      board[i] = AI;
      const score = minimax(board, 0, false);
      board[i] = null;

      if (score > bestScore) {
        bestScore = score;
        move = i;
      }
    }
  }

  return move;
};

export default function App() {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [scores, setScores] = useState(INITIAL_SCORES);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [winningLine, setWinningLine] = useState([]);

  useEffect(() => {
    const loadScores = async () => {
      try {
        const saved = await AsyncStorage.getItem(SCORE_KEY);
        if (saved) {
          setScores(JSON.parse(saved));
        }
      } catch {
        // Keep defaults silently if storage read fails.
      }
    };

    loadScores();
  }, []);

  useEffect(() => {
    const saveScores = async () => {
      try {
        await AsyncStorage.setItem(SCORE_KEY, JSON.stringify(scores));
      } catch {
        // Ignore storage write errors to keep gameplay uninterrupted.
      }
    };

    saveScores();
  }, [scores]);

  const finishGame = (message, winningPlayer = null, line = []) => {
    setGameOver(true);
    setResultMessage(message);
    setWinningLine(line);

    if (winningPlayer === PLAYER) {
      setScores((prev) => ({ ...prev, playerWins: prev.playerWins + 1 }));
    } else if (winningPlayer === AI) {
      setScores((prev) => ({ ...prev, aiWins: prev.aiWins + 1 }));
    } else {
      setScores((prev) => ({ ...prev, draws: prev.draws + 1 }));
    }
  };

  const evaluateBoard = (nextBoard) => {
    const { winner, line } = getWinner(nextBoard);

    if (winner === PLAYER) {
      finishGame('You win! 🎉', PLAYER, line);
      return true;
    }

    if (winner === AI) {
      finishGame('AI wins 😈', AI, line);
      return true;
    }

    if (isBoardFull(nextBoard)) {
      finishGame("It's a draw 🤝");
      return true;
    }

    return false;
  };

  const handlePlayerMove = (index) => {
    if (!isPlayerTurn || gameOver || board[index] !== null) return;

    const nextBoard = [...board];
    nextBoard[index] = PLAYER;
    setBoard(nextBoard);

    const ended = evaluateBoard(nextBoard);
    if (!ended) {
      setIsPlayerTurn(false);
    }
  };

  useEffect(() => {
    if (isPlayerTurn || gameOver) return;

    const timer = setTimeout(() => {
      setBoard((prevBoard) => {
        const boardCopy = [...prevBoard];
        const move = getBestMove(boardCopy);

        if (move === null) {
          return prevBoard;
        }

        boardCopy[move] = AI;
        const ended = evaluateBoard(boardCopy);
        if (!ended) {
          setIsPlayerTurn(true);
        }

        return boardCopy;
      });
    }, 420);

    return () => clearTimeout(timer);
  }, [isPlayerTurn, gameOver]);

  const resetBoard = () => {
    setBoard(Array(9).fill(null));
    setIsPlayerTurn(true);
    setGameOver(false);
    setResultMessage('');
    setWinningLine([]);
  };

  const resetScores = () => {
    Alert.alert('Reset Scores', 'Are you sure you want to reset all scores?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => setScores(INITIAL_SCORES),
      },
    ]);
  };

  const theme = isDarkMode
    ? {
        background: '#0F172A',
        card: '#1E293B',
        cardSoft: '#334155',
        text: '#F8FAFC',
        subText: '#CBD5E1',
        player: '#60A5FA',
        ai: '#F87171',
        accent: '#38BDF8',
        glow: '#7DD3FC',
      }
    : {
        background: '#EEF3FF',
        card: '#FFFFFF',
        cardSoft: '#E2E8F0',
        text: '#0F172A',
        subText: '#475569',
        player: '#2563EB',
        ai: '#DC2626',
        accent: '#0284C7',
        glow: '#BAE6FD',
      };

  const turnText = gameOver ? resultMessage : isPlayerTurn ? 'Your turn – X' : 'AI thinking...';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: theme.text }]}>XO Clash</Text>
          <TouchableOpacity
            style={[styles.themeButton, { backgroundColor: theme.cardSoft }]}
            activeOpacity={0.8}
            onPress={() => setIsDarkMode((prev) => !prev)}>
            <Text style={styles.themeIcon}>{isDarkMode ? '🌞' : '🌙'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.subtitle, { color: theme.subText }]}>Single-player Tic-Tac-Toe</Text>
        <Text style={[styles.permissionText, { color: theme.accent }]}>No permissions required</Text>

        <View style={styles.scoreRow}>
          <View style={[styles.scoreCard, { backgroundColor: theme.cardSoft }]}>
            <Text style={[styles.scoreLabel, { color: theme.subText }]}>You</Text>
            <Text style={[styles.scoreValue, { color: theme.player }]}>{scores.playerWins}</Text>
          </View>
          <View style={[styles.scoreCard, { backgroundColor: theme.cardSoft }]}>
            <Text style={[styles.scoreLabel, { color: theme.subText }]}>AI</Text>
            <Text style={[styles.scoreValue, { color: theme.ai }]}>{scores.aiWins}</Text>
          </View>
          <View style={[styles.scoreCard, { backgroundColor: theme.cardSoft }]}>
            <Text style={[styles.scoreLabel, { color: theme.subText }]}>Draws</Text>
            <Text style={[styles.scoreValue, { color: theme.text }]}>{scores.draws}</Text>
          </View>
        </View>

        <View style={[styles.turnContainer, { backgroundColor: theme.cardSoft, borderColor: theme.glow }]}> 
          <Text style={[styles.turnText, { color: theme.text }]}>{turnText}</Text>
        </View>

        <View style={[styles.board, { backgroundColor: theme.card, borderColor: theme.cardSoft }]}>
          {board.map((cell, index) => {
            const isWinningCell = winningLine.includes(index);
            return (
              <TouchableOpacity
                key={index}
                activeOpacity={0.7}
                style={[
                  styles.cell,
                  {
                    borderColor: theme.cardSoft,
                    backgroundColor: isWinningCell ? theme.glow : theme.card,
                  },
                ]}
                onPress={() => handlePlayerMove(index)}>
                <Text
                  style={[
                    styles.cellText,
                    {
                      color: cell === PLAYER ? theme.player : theme.ai,
                    },
                  ]}>
                  {cell}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.player }]}
            activeOpacity={0.85}
            onPress={resetBoard}>
            <Text style={styles.buttonText}>New Game</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.ai }]}
            activeOpacity={0.85}
            onPress={resetScores}>
            <Text style={styles.buttonText}>Reset Scores</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  permissionText: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 16,
  },
  themeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeIcon: {
    fontSize: 20,
  },
  scoreRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  scoreCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 3,
  },
  turnContainer: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  turnText: {
    fontSize: 18,
    fontWeight: '800',
  },
  board: {
    width: '100%',
    maxWidth: 300,
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: 20,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
    marginBottom: 18,
  },
  cell: {
    width: '33.3333%',
    height: '33.3333%',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellText: {
    fontSize: 52,
    fontWeight: '900',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
