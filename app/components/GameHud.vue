<script setup lang="ts">
const gameContext = inject(GameContextKey);

const isVisible = computed(() => gameContext?.showHud.value === true);
</script>

<template>
  <div v-if="gameContext && isVisible" class="flex items-center gap-2">
    <UBadge v-if="gameContext.showTimer.value" color="warning" variant="soft">
      ⏳ {{ gameContext.remainingSeconds }}s
    </UBadge>

    <div class="relative">
      <UBadge color="primary" variant="soft">
        🥕
        {{ gameContext.score }}
      </UBadge>
      <Transition name="carrot-fx" mode="out-in">
        <span
          v-if="gameContext.carrotDeltaFx.value != null"
          :key="gameContext.carrotDeltaFxKey.value"
          class="pointer-events-none absolute -right-1 -top-6 text-xs font-bold"
          :class="gameContext.carrotDeltaFx.value > 0 ? 'text-success' : 'text-error'"
        >
          {{ gameContext.carrotDeltaFx.value > 0 ? `+${gameContext.carrotDeltaFx.value}` : gameContext.carrotDeltaFx.value }}
        </span>
      </Transition>
    </div>

    <UBadge color="primary" variant="soft">
      ✅ {{ gameContext.answeredCount }}
    </UBadge>
  </div>
</template>

<style scoped>
.carrot-fx-enter-active,
.carrot-fx-leave-active {
  transition: all 0.32s ease;
}

.carrot-fx-enter-from,
.carrot-fx-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.92);
}

.carrot-fx-enter-to,
.carrot-fx-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}
</style>
