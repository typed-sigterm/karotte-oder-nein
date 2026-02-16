<script setup lang="ts" generic="T">
import { VisArea, VisAxis, VisCrosshair, VisLine, VisTooltip, VisXYContainer } from '@unovis/vue';

defineProps<{
  data: T[]
  x: (d: T, i: number) => number
  y: (d: T) => number
  color?: string
  xTickFormat?: (i: number) => string
  yTickFormat?: (i: number) => string
  template?: (d: T) => string
  yDomain?: [number, number]
}>();
</script>

<template>
  <VisXYContainer
    :data
    :scale-by-dimension="yDomain ? { y: { domain: yDomain } } : undefined"
  >
    <VisLine :x :y :color />
    <VisArea :x :y :color :opacity="0.1" />
    <VisAxis type="x" :x :tick-format="xTickFormat" />
    <VisAxis type="y" :y :tick-format="yTickFormat" />
    <VisCrosshair :color :template />
    <VisTooltip />
  </VisXYContainer>
</template>
