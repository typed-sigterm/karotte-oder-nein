<script setup lang="ts">
import { createReusableTemplate } from '@vueuse/core';

defineProps<{
  game: ReturnType<typeof useGame>
}>();

defineEmits<{
  replay: []
  back: []
}>();

const [DefineCorrectCount, CorrectCount] = createReusableTemplate();
</script>

<template>
  <DefineCorrectCount>
    <div>正确回答 / 总答题数</div>
    <div class="text-right font-semibold">
      {{ game.correctCount }} / {{ game.ctx.answeredCount.value }}
    </div>
    <div>正确率</div>
    <div class="text-right font-semibold">
      {{ (game.correctCount.value / game.ctx.answeredCount.value * 100).toFixed(2) }}%
    </div>
  </DefineCorrectCount>

  <UCard class="mb-4" :ui="{ header: 'text-base font-semibold' }">
    <template #header>
      游戏结束
    </template>

    <div class="grid grid-cols-2 gap-2 text-sm">
      <template v-if="game.ctx.mode.value === 'timed'">
        <div>总分</div>
        <div class="text-right font-semibold">
          {{ game.ctx.score.value }}
        </div>
      </template>
      <CorrectCount v-else />

      <div>历史最佳</div>
      <div class="text-right font-semibold">
        {{ game.ctx.mode.value === 'timed' ? game.timedBestScore : game.survivalBestAnswered }}
      </div>

      <div>平均每题耗时</div>
      <div class="text-right font-semibold">
        {{ (game.averageMs.value / 1000).toFixed(2) }}s
      </div>

      <CorrectCount v-if="game.ctx.mode.value === 'timed'" />
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
