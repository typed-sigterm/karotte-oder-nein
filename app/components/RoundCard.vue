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
      <span>{{ game.modeText.value }} · 第 {{ game.currentIndex.value + 1 }} 题</span>
      <span>
        {{ game.selectedPos.value ? `词频排名 ${game.currentWord.value?.frequency}` : '' }}
      </span>
    </template>

    <div class="mb-4 text-center text-3xl font-semibold tracking-wide wrap-break-word hyphens-auto" lang="de">
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
        class="next-button"
        :class="{ 'is-cooldown': game.nextCooldownActive.value }"
        :disabled="game.nextCooldownActive.value"
        @click="emit('next')"
      >
        <span class="next-button-label">下一题</span>
      </UButton>
    </template>
  </UCard>
</template>

<style scoped>
:deep() .next-button {
  position: relative;
  overflow: hidden;
  background-image: linear-gradient(var(--color-primary), var(--color-primary));
  background-repeat: no-repeat;
  background-position: left center;
  background-size: 0% 100%;
}

:deep() .next-button.is-cooldown {
  animation: next-cooldown 1s ease-out;
}

.next-button-label {
  position: relative;
  z-index: 1;
}

@keyframes next-cooldown {
  from {
    background-size: 100% 100%;
  }
  to {
    background-size: 0% 100%;
  }
}
</style>
