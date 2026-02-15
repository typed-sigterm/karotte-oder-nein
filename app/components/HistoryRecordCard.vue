<script setup lang="ts">
import type { GameHistoryRecord } from '~/utils/history-db';

defineProps<{
  record: GameHistoryRecord
  expanded?: boolean
}>();

defineEmits<{
  delete: [id: number]
  toggleExpand: []
}>();

const isExpanded = defineModel<boolean>('expanded', { default: false });

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getModeText(mode: string) {
  return mode === 'timed' ? '限时模式' : '无尽模式';
}
</script>

<template>
  <UCard :ui="{ body: 'p-0' }">
    <div class="p-4 cursor-pointer" @click="isExpanded = !isExpanded">
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1">
          <div class="font-semibold flex items-center gap-2">
            <span>{{ getModeText(record.mode) }}</span>
            <UBadge v-if="record.mode === 'timed'" color="primary" size="xs">
              {{ record.finalScore }} 分
            </UBadge>
            <UBadge v-else color="success" size="xs">
              {{ record.answeredCount }} 题
            </UBadge>
          </div>
          <div class="text-muted text-sm mt-1">
            {{ formatDate(record.timestamp) }}
          </div>
          <div class="text-sm mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
            <div>正确：{{ record.correctCount }} / {{ record.answeredCount }}</div>
            <div v-if="record.accuracy != null">
              正确率：{{ (record.accuracy * 100).toFixed(1) }}%
            </div>
            <div v-if="record.answeredCount > 0">
              平均耗时：{{ (record.averageDurationMs / 1000).toFixed(1) }}s
            </div>
          </div>
        </div>
        <div class="flex gap-1">
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="xs"
            @click.stop="$emit('delete', record.id!)"
          />
          <UButton
            :icon="isExpanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            color="neutral"
            variant="ghost"
            size="xs"
          />
        </div>
      </div>
    </div>

    <div v-if="isExpanded" class="border-t border-border">
      <div class="p-4">
        <GameSummaryTable :rows="record.rounds" />
      </div>
    </div>
  </UCard>
</template>
