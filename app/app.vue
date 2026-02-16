<script setup lang="ts">
const game = useGame();
const showHistoryDrawer = ref(false);

onMounted(game.init);
provide(GameContextKey, game.ctx);
useMixpanel();
</script>

<template>
  <div class="mx-auto min-h-screen w-full max-w-md bg-default px-4 py-4">
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-lg font-bold">
        Karotte oder Nein
      </h1>
      <div class="flex items-center gap-2">
        <GameHud v-if="game.ctx.showHud" />
        <UDrawer v-else v-model:open="showHistoryDrawer" direction="top">
          <UButton
            icon="i-lucide-history"
            color="neutral"
            variant="ghost"
          />
          <template #content>
            <Suspense>
              <template #default>
                <LazyHistoryView />
              </template>
              <template #fallback>
                <Spinner />
              </template>
            </Suspense>
          </template>
        </UDrawer>
      </div>
    </div>

    <Spinner v-if="game.loading.value" />

    <UAlert
      v-else-if="game.errorMessage.value"
      color="error"
      variant="soft"
      :title="game.errorMessage.value"
      class="mb-4"
    />

    <template v-else-if="!game.ctx.mode.value">
      <ModeSelectCard @start="game.startGame" />
      <div class="text-muted text-sm mt-2 flex justify-between">
        <p>
          &copy; 2026-present
          <ULink href="https://typed-sigterm.me/?karotte-oder-nein.by-ts.top&utm_medium=footer" target="_blank">
            Typed SIGTERM
          </ULink>
        </p>
        <ULink href="http://github.com/typed-sigterm/karotte-oder-nein" target="_blank">
          <UIcon name="i-logos-github-icon" />
        </ULink>
      </div>
    </template>

    <Suspense v-else-if="game.isFinished.value">
      <LazyGameOverCard
        :game
         @replay="game.startGame(game.selectedMode.value!)"
        @back="game.backToModeSelect"
      />
        <LazyGameSummaryTable :rows="game.rounds.value" />
      <template #fallback>
        <Spinner />
      </template>
    </Suspense>

    <Suspense v-else-if="game.currentWord.value">
      <LazyRoundCard
        :game
        :correct-pos-list="game.getCorrectPosList(game.currentWord.value!)"
        @choose="game.onChoose"
        @next="game.goToNextRound"
        @ready="game.onRoundCardReady"
      />
      <template #fallback>
        <Spinner />
      </template>
    </Suspense>
  </div>
</template>
