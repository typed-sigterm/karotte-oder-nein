import type { GameHistoryRecord } from '~/utils/history-db';
import { ref } from 'vue';
import { clearAllHistory, deleteGameHistory, getAllGameHistory } from '~/utils/history-db';

export function useGameHistory() {
  const history = ref<GameHistoryRecord[]>([]);
  const loading = ref(false);
  const error = ref<string>('');

  async function loadHistory() {
    if (!import.meta.client)
      return;

    loading.value = true;
    error.value = '';
    try {
      history.value = await getAllGameHistory();
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载历史记录失败';
      console.error('Failed to load history:', e);
    } finally {
      loading.value = false;
    }
  }

  async function deleteRecord(id: number) {
    if (!import.meta.client)
      return;

    try {
      await deleteGameHistory(id);
      history.value = history.value.filter(record => record.id !== id);
    } catch (e) {
      error.value = e instanceof Error ? e.message : '删除记录失败';
      console.error('Failed to delete history:', e);
    }
  }

  async function clearAll() {
    if (!import.meta.client)
      return;

    try {
      await clearAllHistory();
      history.value = [];
    } catch (e) {
      error.value = e instanceof Error ? e.message : '清空记录失败';
      console.error('Failed to clear history:', e);
    }
  }

  return {
    history,
    loading,
    error,
    loadHistory,
    deleteRecord,
    clearAll,
  };
}
