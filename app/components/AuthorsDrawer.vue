<script setup lang="ts">
const authors = [
  { name: 'Typed SIGTERM', role: '开发', href: 'https://typed-sigterm.me' },
  { name: 'Gadfly128', role: '美术协力', href: 'https://github.com/Gadfly128' },
];
</script>

<template>
  <UDrawer direction="bottom" :ui="{ body: 'space-y-1' }">
    <div>
      &copy; 2026-present
      <ULink active>
        Typed SIGTERM et al
      </ULink>
    </div>

    <template #title>
      <div class="flex items-center gap-1">
        <UIcon name="i-lucide-user" size="20" />
        <span>主要贡献者</span>
      </div>
    </template>

    <template #body>
      <div v-for="a in authors" :key="a.name" class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="font-semibold">
            {{ a.name }}
          </div>
          <div class="text-muted text-sm">
            {{ a.role }}
          </div>
        </div>
        <UButton :href="a.href" target="_blank" color="neutral" variant="ghost" size="sm" icon="i-lucide-arrow-right" />
      </div>
    </template>
  </UDrawer>
</template>
