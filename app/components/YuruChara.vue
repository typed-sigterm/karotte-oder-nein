<script setup lang="ts">
import type { Expression, Functions } from '~/utils/yuru-chara';
import { promiseTimeout, useDraggable } from '@vueuse/core';
import urlAngry from '~/assets/yuru-chara/angry.webp?url';
import urlBlushing from '~/assets/yuru-chara/blushing.webp?url';
import urlComplaining from '~/assets/yuru-chara/complaining.webp?url';
import urlGloomy from '~/assets/yuru-chara/gloomy.webp?url';
import urlHappy from '~/assets/yuru-chara/happy.webp?url';
import urlNormal from '~/assets/yuru-chara/normal.webp?inline';
import urlWeeping from '~/assets/yuru-chara/weeping.webp?url';
import urlWink1 from '~/assets/yuru-chara/wink/1.webp?url';
import urlWink2 from '~/assets/yuru-chara/wink/2.webp?url';
import urlWink3 from '~/assets/yuru-chara/wink/3.webp?url';

const el = useTemplateRef('el');
const container = useTemplateRef('container');
const imageSrc = ref(urlNormal);

const storedPos = {
  x: Number.parseInt(localStorage.getItem('yuru-chara:x') || '?'),
  y: Number.parseInt(localStorage.getItem('yuru-chara:y') || '?'),
};
const isStoredPosValid = !Number.isNaN(storedPos.x) && !Number.isNaN(storedPos.y);
const { style, position } = useDraggable(el, {
  initialValue: isStoredPosValid ? storedPos : undefined,
  onEnd(pos) {
    localStorage.setItem('yuru-chara:x', pos.x.toFixed(0).toString());
    localStorage.setItem('yuru-chara:y', pos.y.toFixed(0).toString());
  },
});

onMounted(() => {
  if (!container.value)
    throw new Error('Container element not found');
  if (isStoredPosValid)
    return;
  position.value = {
    x: container.value.offsetLeft + container.value.clientWidth - 86,
    y: container.value.offsetTop + container.value.clientHeight - 10,
  };
});

const winking = ref(false);
async function wink() {
  if (winking.value)
    return;
  winking.value = true;
  for (const x of [urlWink1, urlWink2, urlWink3, urlWink2, urlWink1, urlNormal]) {
    imageSrc.value = x;
    await promiseTimeout(30);
  }
  winking.value = false;
}

const ExpressionImage: Record<Expression, string> = {
  normal: urlNormal,
  happy: urlHappy,
  blushing: urlBlushing,
  angry: urlAngry,
  complaining: urlComplaining,
  gloomy: urlGloomy,
  weeping: urlWeeping,
};
function changeExpression(expression: Expression) {
  if (winking.value)
    return;
  imageSrc.value = ExpressionImage[expression];
}

defineExpose<Functions>({ wink, changeExpression });
</script>

<template>
  <div ref="container" class="w-full">
    <img
      ref="el"
      class="fixed select-none cursor-pointer"
      :style
      :src="imageSrc"
      draggable="false"
      width="106"
      height="106"
      @click="wink"
    >
  </div>
</template>
