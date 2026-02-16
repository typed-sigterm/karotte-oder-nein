/* eslint-disable ts/no-redeclare */
import type { ManualResetRefReturn } from '@vueuse/core';
import type { ComputedRef, InjectionKey, Ref } from 'vue';
import * as z from 'zod';

export const PosMap = { M: 1, N: 2, F: 3 } as const;
export const Pos = z.enum(PosMap);
export type Pos = z.infer<typeof Pos>;

export const GameMode = z.enum(['timed', 'survival']);
export type GameMode = z.infer<typeof GameMode>;

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

export const RoundResult = z.intersection(z.object({
  word: z.string(),
  frequency: z.int(),
  verdictMap: z.record(Pos, z.boolean()),
}), z.union([
  z.object({}), // 未答
  z.object({
    selectedPos: Pos,
    carrot: z.int(),
    duration: z.int(), // 单位 ms
  }),
]));
export type RoundResult = z.infer<typeof RoundResult>;

export const GameResult = z.intersection(z.object({
  schema: z.literal(1),
  carrot: z.int(),
  correct: z.int(),
  startedAt: z.date(),
  endedAt: z.date(),
  rounds: z.array(RoundResult),
}), z.union([
  z.object({
    mode: z.literal('timed'),
    historicalBestCarrot: z.int(),
  }),
  z.object({
    mode: z.literal('survival'),
    historicalBestCorrect: z.int(),
  }),
]));
export type GameResult = z.infer<typeof GameResult>;
