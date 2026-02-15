<script setup lang="ts">
const { history, loading, error, loadHistory, deleteRecord, clearAll } = useGameHistory();
const showClearDialog = ref(false);

defineEmits<{
  back: []
}>();

onMounted(() => {
  void loadHistory();
});

async function handleDelete(id: number) {
  if (confirm('确定要删除这条记录吗？')) {
    await deleteRecord(id);
  }
}

async function handleClearAll() {
  showClearDialog.value = false;
  await clearAll();
}
</script>

<template>
  <div>
    <UCard class="mb-4" :ui="{ header: 'flex items-center' }">
      <template #header>
        <UButton
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="ghost"
          @click="$emit('back')"
        />
        <div class="font-semibold flex-1 text-center">
          游戏历史记录
        </div>
        <UButton
          v-if="history.length > 0"
          icon="i-lucide-trash-2"
          color="red"
          variant="ghost"
          @click="showClearDialog = true"
        />
      </template>

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

      <div v-else class="space-y-3">
        <HistoryRecordCard
          v-for="record in history"
          :key="record.id"
          :record="record"
          @delete="handleDelete"
        />
      </div>
    </UCard>

    <UModal v-model="showClearDialog">
      <UCard>
        <template #header>
          <div class="font-semibold">
            确认清空
          </div>
        </template>

        <div class="text-sm mb-4">
          确定要清空所有历史记录吗？此操作无法撤销。
        </div>

        <div class="flex gap-2 justify-end">
          <UButton
            color="neutral"
            variant="outline"
            @click="showClearDialog = false"
          >
            取消
          </UButton>
          <UButton
            color="red"
            @click="handleClearAll"
          >
            清空
          </UButton>
        </div>
      </UCard>
    </UModal>
  </div>
</template>
