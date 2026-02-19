<script setup lang="ts">
const yuruChara = useTemplateRef('yuruChara');
const game = useGame(yuruChara as any);

onMounted(game.init);
provide(GameContextKey, game.ctx);
useMixpanel();
</script>

<template>
  <div class="mb-4 flex items-center justify-between">
    <h1 class="text-lg font-bold">
      Karotte oder Nein
    </h1>
    <div class="flex items-center h-0 gap-1">
      <GameHud v-if="game.ctx.showHud.value" />
      <template v-else>
        <HistoryDrawer />
        <ChangelogDrawer />
      </template>
    </div>
  </div>

  <div class="flex-1 flex flex-col">
    <Spinner v-if="game.loading.value" />

    <UAlert
      v-else-if="game.errorMessage.value"
      color="error"
      variant="soft"
      :title="game.errorMessage.value"
      class="mb-4"
    />

    <Suspense v-else-if="!game.ctx.mode.value">
      <ModeSelectCard @start="game.startGame" />
      <template #fallback>
        <Spinner />
      </template>
    </Suspense>

    <Suspense v-else-if="game.isFinished.value && game.finalResult.value">
      <div>
        <LazyGameOverCard
          :result="game.finalResult.value"
          @replay="game.startGame(game.selectedMode.value!)"
          @back="game.backToModeSelect"
        />
        <LazyGameSummaryTable :rows="game.finalResult.value.rounds" />
      </div>
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

    <LazyYuruChara ref="yuruChara" />

    <div class="text-muted text-sm mt-auto pt-2 flex justify-between">
      <p>
        &copy; 2026-present
        <ULink href="https://typed-sigterm.me/?utm_source=karotte-oder-nein.by-ts.top&utm_medium=footer" target="_blank">
          Typed SIGTERM
        </ULink>
      </p>
      <ULink href="http://github.com/typed-sigterm/karotte-oder-nein" target="_blank">
        <UIcon name="i-logos-github-icon" />
      </ULink>
    </div>
  </div>
</template>
