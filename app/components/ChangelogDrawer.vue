<script setup lang="ts">
import type { TimelineItem } from '@nuxt/ui';
import changelog from '#changelog';

const TypeIcon = {
  feat: 'i-lucide-sparkle',
  fix: 'i-lucide-wrench',
  refactor: 'i-lucide-blocks',
  perf: 'i-lucide-rocket',
};

const items = changelog.map(x => ({
  title: x.title,
  description: x.description,
  date: new Date(x.date).toLocaleString(),
  icon: (TypeIcon as any)[x.type] || 'i-lucide-git-commit-horizontal',
} as TimelineItem)).concat([{
  icon: 'i-lucide-ellipsis',
  slot: 'more',
} satisfies TimelineItem]);
// eslint-disable-next-line prefer-template
const fullLink = 'https://github.com/typed-sigterm/karotte-oder-nein/commits/main'
  + (changelog[0]?.id ? `?since=${changelog[0].id}` : '');
</script>

<template>
  <UDrawer direction="top">
    <UButton icon="i-lucide-git-commit-horizontal" color="neutral" variant="ghost" />

    <template #title>
      <div class="flex items-center gap-1">
        <UIcon name="i-lucide-git-commit-horizontal" size="20" />
        <span>最近更新</span>
      </div>
    </template>

    <template #body>
      <UTimeline :items>
        <template #more-description>
          <ULink :href="fullLink" target="_blank">
            查看完整更新记录
          </ULink>
        </template>
      </UTimeline>
    </template>
  </UDrawer>
</template>
