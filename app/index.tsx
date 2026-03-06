import { useMemo, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Link } from 'expo-router';

import { HelloWave } from '@/components/hello-wave';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

type Task = {
  id: number;
  label: string;
  done: boolean;
};

const INITIAL_TASKS: Task[] = [
  { id: 1, label: 'Run the app locally', done: false },
  { id: 2, label: 'Review the default screen', done: false },
  { id: 3, label: 'Open the modal route', done: false },
];

export default function HomeScreen() {
  const [tasks, setTasks] = useState(INITIAL_TASKS);

  const completedCount = useMemo(() => tasks.filter((task) => task.done).length, [tasks]);

  const toggleTask = (id: number) => {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === id
          ? {
              ...task,
              done: !task.done,
            }
          : task
      )
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Welcome!</ThemedText>
        <HelloWave />
      </ThemedView>

      <ThemedText>
        This app now uses a single-screen navigation flow (no bottom tabs), with a tiny local
        progress tracker that works without any device permissions.
      </ThemedText>

      <ThemedText type="subtitle">Quick start checklist</ThemedText>
      <ThemedText>
        Completed {completedCount} of {tasks.length}
      </ThemedText>

      <ThemedView style={styles.listContainer}>
        {tasks.map((task) => (
          <Pressable key={task.id} onPress={() => toggleTask(task.id)} style={styles.taskButton}>
            <ThemedText type={task.done ? 'defaultSemiBold' : 'default'}>
              {task.done ? '✅' : '⬜️'} {task.label}
            </ThemedText>
          </Pressable>
        ))}
      </ThemedView>

      <Link href="/modal">
        <ThemedText type="link">Open modal screen</ThemedText>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 14,
  },
  listContainer: {
    gap: 10,
  },
  taskButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8a8a8a',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
