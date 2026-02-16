<script setup lang="ts">
import type { AccordionItem } from '@nuxt/ui';
import type { GameMode, GameResult } from '~/utils/game';

const { history, loading, error, loadHistory, deleteRecord } = useGameHistory();
const showDeleteDialog = ref(false);
const deleteTarget = ref<number | null>(null);

const currentPage = ref(1);
const itemsPerPage = 10;

onMounted(() => void loadHistory());

function promptDelete(id: number) {
  deleteTarget.value = id;
  showDeleteDialog.value = true;
}

async function handleDelete() {
  if (deleteTarget.value != null) {
    await deleteRecord(deleteTarget.value);
  }
  showDeleteDialog.value = false;
  deleteTarget.value = null;
}

function formatDate(date: Date) {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const getModeText = (mode: GameMode) => mode === 'timed' ? '限时模式' : '无尽模式';
const getStats = (x: GameResult) => x.mode === 'timed' ? `🥕 ${x.carrot}` : `✅ ${x.correct}`;

const paginatedHistory = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  return history.value.slice(start, end);
});

const totalPages = computed(() => Math.ceil(history.value.length / itemsPerPage));

const paginatedEntries = computed(() => {
  return paginatedHistory.value.map(record => ({
    record,
    stats: getGameResultStats(record),
  }));
});

const accordionItems = computed<AccordionItem[]>(() => paginatedEntries.value.map(({ record }) => ({
  label: `${getModeText(record.mode)} · ${getStats(record)} · ${formatDate(record.endedAt)}`,
  value: String(record.id),
})));
</script>

<template>
  <Spinner v-if="loading" />

  <UAlert
    v-else-if="error"
    color="error"
    variant="soft"
    :title="error"
  />

  <UEmpty v-else-if="history.length === 0" description="暂无历史记录" icon="i-lucide-inbox" />

  <div v-else class="space-y-4">
    <UAccordion :items="accordionItems">
      <template #body="{ item }">
        <div v-for="entry in paginatedEntries.filter(v => String(v.record.id) === item.value)" :key="entry.record.id" class="space-y-3 p-1">
          <div class="flex items-start justify-between gap-2">
            <div class="w-full text-sm mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
              <div>正确：{{ entry.stats.correctCount }} / {{ entry.stats.answeredCount }}</div>
              <div v-if="entry.stats.accuracy != null">
                正确率：{{ (entry.stats.accuracy * 100).toFixed(1) }}%
              </div>
              <div v-if="entry.stats.answeredCount > 0">
                平均耗时：{{ (entry.stats.averageDurationMs / 1000).toFixed(1) }}s
              </div>
              <div>
                历史最高：{{ entry.record.mode === 'timed' ? entry.record.historicalBestCarrot : entry.record.historicalBestCorrect }}
              </div>
            </div>
            <UButton
              v-if="0"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="xs"
              @click.stop="promptDelete(entry.record.id!)"
            />
          </div>
          <GameSummaryTable :rows="entry.record.rounds" />
        </div>
      </template>
    </UAccordion>

    <div v-if="totalPages > 1" class="flex justify-center gap-2">
      <UButton
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="ghost"
        size="xs"
        :disabled="currentPage === 1"
        @click="currentPage--"
      />
      <div class="flex items-center gap-1 text-sm">
        <span>{{ currentPage }}</span>
        <span class="text-muted">/</span>
        <span class="text-muted">{{ totalPages }}</span>
      </div>
      <UButton
        icon="i-lucide-chevron-right"
        color="neutral"
        variant="ghost"
        size="xs"
        :disabled="currentPage === totalPages"
        @click="currentPage++"
      />
    </div>
  </div>

  <UModal v-model:open="showDeleteDialog" title="确认删除" description="确定要删除这条记录吗？此操作无法撤销。">
    <template #footer>
      <div class="flex gap-2 justify-end">
        <UButton
          color="neutral"
          variant="outline"
          label="取消"
          @click="showDeleteDialog = false"
        />
        <UButton
          color="error"
          label="删除"
          @click="handleDelete"
        />
      </div>
    </template>
  </UModal>
</template>
