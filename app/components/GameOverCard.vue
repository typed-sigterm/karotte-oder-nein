<script setup lang="ts">
import type { GameResult } from '~/utils/game';
import { createReusableTemplate } from '@vueuse/core';
import { getGameResultStats } from '~/utils/history';

const props = defineProps<{
  result: GameResult
}>();

defineEmits<{
  replay: []
  back: []
}>();

const [DefineCorrectCount, CorrectCount] = createReusableTemplate();
const stats = computed(() => getGameResultStats(props.result));
</script>

<template>
  <DefineCorrectCount>
    <div>正确回答 / 总答题数</div>
    <div class="text-right font-semibold">
      {{ stats.correctCount }} / {{ stats.answeredCount }}
    </div>
    <template v-if="stats.answeredCount > 0 && stats.accuracy != null">
      <div>正确率</div>
      <div class="text-right font-semibold">
        {{ (stats.accuracy * 100).toFixed(2) }}%
      </div>
    </template>
  </DefineCorrectCount>

  <UCard class="mb-4" :ui="{ header: 'text-base font-semibold' }">
    <template #header>
      游戏结束
    </template>

    <div class="grid grid-cols-2 gap-2 text-sm">
      <template v-if="result.mode === 'timed'">
        <div>总分</div>
        <div class="text-right font-semibold">
          {{ result.carrot }}
        </div>
      </template>
      <CorrectCount v-else />

      <div>历史最佳</div>
      <div class="text-right font-semibold">
        {{ result.mode === 'timed' ? result.historicalBestCarrot : result.historicalBestCorrect }}
      </div>

      <template v-if="stats.answeredCount > 0">
        <div>平均每题耗时</div>
        <div class="text-right font-semibold">
          {{ (stats.averageDurationMs / 1000).toFixed(2) }}s
        </div>
      </template>

      <CorrectCount v-if="result.mode === 'timed'" />
    </div>

    <div class="mt-4 grid grid-cols-2 gap-2">
      <UButton color="primary" block @click="$emit('replay')">
        再来一局
      </UButton>
      <UButton color="neutral" block variant="outline" @click="$emit('back')">
        返回
      </UButton>
    </div>
  </UCard>
</template>
