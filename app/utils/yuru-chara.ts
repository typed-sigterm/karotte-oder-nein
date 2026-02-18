import type { ShallowRef } from 'vue';

export type Expression = 'normal' | 'happy' | 'blushing' | 'angry' | 'complaining' | 'gloomy' | 'weeping';
export interface Functions {
  wink: () => Promise<void>
  changeExpression: (expression: Expression) => void
}

export type YuruCharaRef = Readonly<ShallowRef<Functions | undefined>>;
