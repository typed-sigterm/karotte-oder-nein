<script setup lang="ts">
import type { Pos } from '~/utils/data';

const props = defineProps<{
  selectedPos?: Pos
  correctPosList: Pos[]
  revealAnswer: boolean
}>();

const emit = defineEmits<{
  choose: [value: Pos]
}>();

const options: Array<{ value: Pos, label: string }> = [
  { value: 1, label: 'm. (der)' },
  { value: 2, label: 'n. (das)' },
  { value: 3, label: 'f. (die)' },
];

function getVariant(value: Pos): 'outline' | 'soft' | 'solid' {
  if (!props.revealAnswer)
    return 'outline';
  if (props.selectedPos === value || props.correctPosList.includes(value))
    return 'solid';
  return 'outline';
}

function getColor(value: Pos): 'neutral' | 'success' | 'error' {
  if (!props.revealAnswer)
    return 'neutral';
  if (props.correctPosList.includes(value))
    return 'success';
  if (props.selectedPos === value)
    return 'error';
  return 'neutral';
}

function onChoose(value: Pos) {
  if (props.selectedPos != null)
    return;
  emit('choose', value);
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <UButton
      v-for="option in options"
      :key="option.value"
      block
      size="xl"
      :variant="getVariant(option.value)"
      :color="getColor(option.value)"
      :disabled="selectedPos != null"
      @click="onChoose(option.value)"
    >
      {{ option.label }}
    </UButton>
  </div>
</template>
