<script setup lang="ts">
import type { GameMode } from '~/utils/game';

const emit = defineEmits<{
  start: [mode: GameMode]
}>();
</script>

<template>
  <UCard :ui="{ header: 'flex justify-center font-bold' }">
    <template #header>
      选择模式
    </template>

    <div class="space-y-3">
      <UButton block color="neutral" variant="outline" icon="i-lucide-hourglass" @click="emit('start', 'timed')">
        限时模式
      </UButton>
      <UButton block color="neutral" variant="outline" icon="i-lucide-infinity" @click="emit('start', 'survival')">
        无尽模式
      </UButton>
    </div>
  </UCard>
</template>
