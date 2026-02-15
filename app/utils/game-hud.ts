import type { ManualResetRefReturn } from '@vueuse/core';
import type { ComputedRef, InjectionKey, Ref } from 'vue';

export type GameMode = 'timed' | 'survival';

export interface GameContext {
  mode: ComputedRef<GameMode | undefined>
  showHud: ComputedRef<boolean>
  showTimer: ComputedRef<boolean>
  remainingSeconds: ComputedRef<number>
  score: ManualResetRefReturn<number>
  answeredCount: ComputedRef<number>
  carrotDeltaFx: Ref<number | undefined>
  carrotDeltaFxKey: Ref<number>
}

export const GameContextKey: InjectionKey<GameContext> = Symbol('game-context');

export type GameHudContext = GameContext;
export const GameHudKey = GameContextKey;
