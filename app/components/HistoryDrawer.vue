<script setup lang="ts">
const { history, clearAll } = useGameHistory();
const showClearDialog = ref(false);

async function handleClearAll() {
  showClearDialog.value = false;
  await clearAll();
}
</script>

<template>
  <UDrawer direction="top" :ui="{ header: 'flex justify-between' }">
    <UButton icon="i-lucide-history" color="neutral" variant="ghost" />

    <template #title>
      <div class="flex items-center gap-1">
        <UIcon name="i-lucide-history" size="20" />
        <span>历史记录</span>
      </div>
      <UButton
        v-if="history.length > 0"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        size="xs"
        @click="showClearDialog = true"
      />
    </template>

    <template #body>
      <Suspense>
        <LazyHistoryView />
        <template #fallback>
          <Spinner />
        </template>
      </Suspense>
    </template>
  </UDrawer>

  <UModal
    v-model:open="showClearDialog"
    title="确认清空"
    description="确定要清空所有历史记录吗？此操作无法撤销。"
    :ui="{ footer: 'flex gap-2 justify-end' }"
  >
    <template #footer>
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
    </template>
  </UModal>
</template>
