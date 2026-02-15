<script setup lang="ts">
import { useGame } from '~/composables/useGame';
import { GameContextKey } from '~/utils/game-hud';

const game = useGame();

onMounted(game.init);
provide(GameContextKey, game.ctx);
</script>

<template>
  <div class="mx-auto min-h-screen w-full max-w-md bg-default px-4 py-4">
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-lg font-bold">
        Karotte oder Nein
      </h1>
      <GameHud v-if="game.ctx.showHud" />
    </div>

    <div v-if="game.loading.value" class="flex justify-center py-20">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin" />
    </div>

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

    <template v-else-if="game.isFinished.value">
      <GameOverCard
        :game
        @replay="game.startGame(game.selectedMode.value!)"
        @back="game.backToModeSelect"
      />

      <GameSummaryTable :rows="game.rounds.value" />
    </template>

    <RoundCard
      v-else-if="game.currentWord.value"
      :game
      :correct-pos-list="game.getCorrectPosList(game.currentWord.value!)"
      @choose="game.onChoose"
      @next="game.goToNextRound"
    />
  </div>
</template>
