/* eslint-disable ts/no-redeclare */
import type { ManualResetRefReturn } from '@vueuse/core';
import type { ComputedRef, InjectionKey, Ref } from 'vue';
import * as v from 'valibot';

export const PosMap = { M: 1, N: 2, F: 3 } as const;
export const Pos = v.union([v.literal(1), v.literal(2), v.literal(3)]);
export type Pos = v.InferOutput<typeof Pos>;

export const GameMode = v.picklist(['timed', 'survival']);
export type GameMode = v.InferOutput<typeof GameMode>;

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

export const RoundResult = v.intersect([v.object({
  word: v.string(),
  frequency: v.pipe(v.number(), v.integer()),
  verdictMap: v.record(v.string(), v.boolean()),
}), v.union([
  v.object({}), // 未答
  v.object({
    selectedPos: Pos,
    carrot: v.pipe(v.number(), v.integer()),
    duration: v.pipe(v.number(), v.integer()), // 单位 ms
  }),
])]);
export type RoundResult = v.InferOutput<typeof RoundResult>;

export const GameResult = v.intersect([v.object({
  schema: v.literal(1),
  carrot: v.pipe(v.number(), v.integer()),
  correct: v.pipe(v.number(), v.integer()),
  startedAt: v.date(),
  endedAt: v.date(),
  rounds: v.array(RoundResult),
}), v.union([
  v.object({
    mode: v.literal('timed'),
    historicalBestCarrot: v.pipe(v.number(), v.integer()),
  }),
  v.object({
    mode: v.literal('survival'),
    historicalBestCorrect: v.pipe(v.number(), v.integer()),
  }),
])]);
export type GameResult = v.InferOutput<typeof GameResult>;
