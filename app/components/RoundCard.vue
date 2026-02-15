<script setup lang="ts">
import type { Pos } from '~/utils/data';

defineProps<{
  game: ReturnType<typeof useGame>
  correctPosList: Pos[]
}>();

const emit = defineEmits<{
  choose: [pos: Pos]
  next: []
  ready: []
}>();

onMounted(() => emit('ready'));
</script>

<template>
  <UCard :ui="{ header: 'flex items-center justify-between text-sm' }">
    <template #header>
      <span>{{ game.modeText }} · 第 {{ game.currentIndex.value + 1 }} 题</span>
      <span>
        {{ game.selectedPos.value ? `词频排名 ${game.currentWord.value?.frequency}` : '' }}
      </span>
    </template>

    <div class="mb-4 text-center text-3xl font-semibold tracking-wide">
      {{ game.currentWord.value?.word }}
    </div>

    <PosChoiceButtons
      :selected-pos="game.selectedPos.value"
      :correct-pos-list
      :reveal-answer="game.revealAnswer.value"
      @choose="emit('choose', $event)"
    />

    <template v-if="game.revealAnswer.value" #footer>
      <UButton
        block
        color="primary"
        variant="outline"
        @click="emit('next')"
      >
        下一题
      </UButton>
    </template>
  </UCard>
</template>
