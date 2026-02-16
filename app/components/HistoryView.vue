<script setup lang="ts">
import type { AccordionItem } from '@nuxt/ui';

const { history, loading, error, loadHistory, deleteRecord, clearAll } = useGameHistory();
const showClearDialog = ref(false);
const showDeleteDialog = ref(false);
const deleteTarget = ref<number | null>(null);

// Pagination
const currentPage = ref(1);
const itemsPerPage = 10;

onMounted(() => {
  void loadHistory();
});

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

async function handleClearAll() {
  showClearDialog.value = false;
  await clearAll();
}

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

// Paginated history
const paginatedHistory = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  return history.value.slice(start, end);
});

const totalPages = computed(() => Math.ceil(history.value.length / itemsPerPage));

// Each game is its own accordion item
const accordionItems = computed<AccordionItem[]>(() => paginatedHistory.value.map(record => ({
  label: `${getModeText(record.mode)} - ${formatDate(record.timestamp)}`,
  value: String(record.id),
})));
</script>

<template>
  <div class="p-4">
    <div class="mb-4 flex items-center justify-between">
      <div class="font-semibold flex-1">
        游戏历史记录
      </div>
      <UButton
        v-if="history.length > 0"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        size="xs"
        @click="showClearDialog = true"
      />
    </div>

    <div v-if="loading" class="text-center py-8">
      <Spinner />
    </div>

    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      :title="error"
    />

    <div v-else-if="history.length === 0" class="text-center text-muted py-8">
      <UIcon name="i-lucide-inbox" class="text-4xl mb-2" />
      <div>暂无历史记录</div>
      <div class="text-sm mt-1">
        完成游戏后，记录会自动保存在这里
      </div>
    </div>

    <div v-else class="space-y-4">
      <UAccordion :items="accordionItems">
        <template #body="{ item }">
          <div v-for="record in paginatedHistory.filter(r => String(r.id) === item.value)" :key="record.id" class="space-y-3">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <UBadge v-if="record.mode === 'timed'" color="primary" size="xs">
                    {{ record.finalScore }} 分
                  </UBadge>
                  <UBadge v-else color="success" size="xs">
                    {{ record.answeredCount }} 题
                  </UBadge>
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
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                @click.stop="promptDelete(record.id!)"
              />
            </div>
            <GameSummaryTable :rows="record.rounds" />
          </div>
        </template>
      </UAccordion>

      <!-- Pagination -->
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

    <!-- Delete confirmation modal -->
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

    <!-- Clear all confirmation modal -->
    <UModal v-model:open="showClearDialog" title="确认清空" description="确定要清空所有历史记录吗？此操作无法撤销。">
      <template #footer>
        <div class="flex gap-2 justify-end">
          <UButton
            color="neutral"
            variant="outline"
            label="取消"
            @click="showClearDialog = false"
          />
          <UButton
            color="error"
            label="清空"
            @click="handleClearAll"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
