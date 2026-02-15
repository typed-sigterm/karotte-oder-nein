import type { Pos, WordData as Word } from '~/utils/data';
import type { GameContext, GameMode } from '~/utils/game-hud';
import { shuffle } from '@std/random';
import { refAutoReset, refManualReset, useCountdown, useLocalStorage, whenever } from '@vueuse/core';
import confetti from 'canvas-confetti';
import { trackEvent } from './analytics';

const TimedSeconds = 60;
const SurvivalWrongPenaltyBase = 1.15;

interface RoundResult {
  round: number
  word: string
  frequency: number
  selectedPos?: Pos
  correctPosList: Pos[]
  resultState: 'correct' | 'wrong' | 'unanswered'
  durationMs: number
  gainedScore: number
}

export function useGame() {
  const sourceWords = ref<Word[]>([]);
  const words = ref<Word[]>([]);
  const loading = ref(true);
  const errorMessage = ref('');

  const selectedMode = ref<GameMode>();
  const currentIndex = refManualReset(0);
  const selectedPos = refManualReset<Pos | undefined>(undefined);
  const revealAnswer = refManualReset(false);
  const roundStartedAt = ref(0);
  const isTimedUp = ref(false);
  const pendingTimedRoundReady = ref(false);

  const rounds = ref<RoundResult[]>([]);
  const timedBestScore = useLocalStorage('best:timed', 0);
  const survivalBestAnswered = useLocalStorage('best:survival', 0);

  const countdown = useCountdown(TimedSeconds, {
    onComplete: () => isTimedUp.value = true,
  });

  const currentWord = computed(() => words.value[currentIndex.value] || null);
  const ctx: GameContext = (() => {
    const score = refManualReset(0);
    const isRoundFinished = () => {
      if (loading.value || !selectedMode.value)
        return false;
      return isTimedUp.value
        || (selectedMode.value === 'survival' && score.value < 0)
        || currentIndex.value >= words.value.length;
    };

    return {
      mode: computed(() => selectedMode.value),
      showHud: computed(() => selectedMode.value != null && !isRoundFinished()),
      showTimer: computed(() => selectedMode.value === 'timed'),
      remainingSeconds: computed(() => countdown.remaining.value),
      score,
      answeredCount: computed(() => rounds.value.filter(item => item.resultState !== 'unanswered').length),
      carrotDeltaFx: refAutoReset<number | undefined>(undefined, 900),
      carrotDeltaFxKey: ref(0),
    };
  })();

  const isFinished = computed(() => {
    if (loading.value || !selectedMode.value)
      return false;
    return isTimedUp.value
      || (selectedMode.value === 'survival' && ctx.score.value < 0)
      || currentIndex.value >= words.value.length;
  });

  const modeText = computed(() => (selectedMode.value === 'timed' ? '限时模式' : '无尽模式'));
  const correctCount = computed(() => rounds.value.filter(item => item.resultState === 'correct').length);
  const averageMs = computed(() => {
    if (!rounds.value.length)
      return 0;
    const sum = rounds.value.reduce((acc, row) => acc + row.durationMs, 0);
    return sum / rounds.value.length;
  });

  function calcScore(i: number, k = 2000): number {
    return Math.ceil(20 * (i / k) * Math.exp(1 - i / k));
  }

  function getCorrectPosList(word: Word): Pos[] {
    const posList: Pos[] = [];
    if (word.pos_m === 1)
      posList.push(1);
    if (word.pos_n === 1)
      posList.push(2);
    if (word.pos_f === 1)
      posList.push(3);
    if (posList.length === 0)
      posList.push(0);
    return posList;
  }

  function startRound() {
    selectedPos.reset();
    revealAnswer.reset();
    roundStartedAt.value = Date.now();
  }

  function playCarrotFx(delta: number) {
    if (!delta)
      return;
    ctx.carrotDeltaFx.value = delta;
    ctx.carrotDeltaFxKey.value += 1;
  }

  function addCarrot(delta: number) {
    ctx.score.value += delta;
    playCarrotFx(delta);
  }

  function triggerRecordConfetti() {
    if (!import.meta.client)
      return;
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.7 },
    });
  }

  function startGame(mode: GameMode) {
    selectedMode.value = mode;
    words.value = shuffle([...sourceWords.value]);
    currentIndex.reset();
    rounds.value = [];
    ctx.score.reset();
    isTimedUp.value = false;
    ctx.carrotDeltaFx.value = undefined;
    selectedPos.reset();
    revealAnswer.reset();
    if (mode === 'timed') {
      countdown.stop();
      countdown.reset(TimedSeconds);
      pendingTimedRoundReady.value = true;
    } else {
      countdown.stop();
      countdown.reset(TimedSeconds);
      pendingTimedRoundReady.value = false;
    }
    if (words.value.length > 0)
      startRound();

    void trackEvent('mode_selected', { mode });
  }

  function onRoundCardReady() {
    if (selectedMode.value !== 'timed' || !pendingTimedRoundReady.value)
      return;
    pendingTimedRoundReady.value = false;
    roundStartedAt.value = Date.now();
    countdown.start(TimedSeconds);
  }

  function backToModeSelect() {
    countdown.stop();
    countdown.reset(TimedSeconds);
    selectedMode.value = undefined;
    words.value = [];
    currentIndex.reset();
    rounds.value = [];
    ctx.score.reset();
    isTimedUp.value = false;
    pendingTimedRoundReady.value = false;
    selectedPos.reset();
    revealAnswer.reset();
    ctx.carrotDeltaFx.value = undefined;
  }

  function goToNextRound() {
    if (isFinished.value)
      return;
    currentIndex.value++;
    if (currentIndex.value < words.value.length)
      startRound();
  }

  function onChoose(pos: Pos) {
    if (!currentWord.value || selectedPos.value != null || isFinished.value)
      return;

    selectedPos.value = pos;
    revealAnswer.value = true;

    const now = Date.now();
    const durationMs = Math.max(0, now - roundStartedAt.value);
    const correctPosList = getCorrectPosList(currentWord.value);
    const isCorrect = correctPosList.includes(pos);
    const scoreDelta = calcScore(currentWord.value.frequency);
    const previousWrongCount = rounds.value.filter(item => item.resultState === 'wrong').length;
    const survivalWrongPenalty = Math.ceil(scoreDelta * SurvivalWrongPenaltyBase ** previousWrongCount);
    const delta = isCorrect
      ? scoreDelta
      : (selectedMode.value === 'survival' ? -survivalWrongPenalty : 0);

    addCarrot(delta);

    rounds.value.push({
      round: currentIndex.value + 1,
      word: currentWord.value.word,
      frequency: currentWord.value.frequency,
      selectedPos: pos,
      correctPosList,
      resultState: isCorrect ? 'correct' : 'wrong',
      durationMs,
      gainedScore: delta,
    });

    void trackEvent('answer_selected', {
      mode: selectedMode.value,
      round: currentIndex.value + 1,
      word: currentWord.value.word,
      selected_pos: pos,
      correct_pos_list: correctPosList,
      is_correct: isCorrect,
      duration_ms: durationMs,
      score_delta: delta,
      score_after: ctx.score.value,
      wrong_count_before: previousWrongCount,
    });

    if (selectedMode.value === 'survival' && ctx.score.value < 0)
      return;

    if (isCorrect && correctPosList.length === 1)
      goToNextRound();
  }

  async function init() {
    loading.value = true;
    errorMessage.value = '';

    try {
      sourceWords.value = await loadWords();
      backToModeSelect();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '加载词库失败';
    } finally {
      loading.value = false;
    }
  }

  whenever(isFinished, () => {
    const unfinishedRound = currentWord.value;
    const hasAnsweredCurrentRound = rounds.value.some(item => item.round === currentIndex.value + 1);
    if (unfinishedRound && selectedPos.value == null && !hasAnsweredCurrentRound) {
      rounds.value.push({
        round: currentIndex.value + 1,
        word: unfinishedRound.word,
        frequency: unfinishedRound.frequency,
        selectedPos: undefined,
        correctPosList: getCorrectPosList(unfinishedRound),
        resultState: 'unanswered',
        durationMs: Math.max(0, Date.now() - roundStartedAt.value),
        gainedScore: 0,
      });
    }

    countdown.pause();

    const answeredCount = ctx.answeredCount.value;
    const accuracy = answeredCount > 0
      ? correctCount.value / answeredCount
      : undefined;

    if (selectedMode.value === 'timed') {
      const previousBest = timedBestScore.value;
      timedBestScore.value = Math.max(timedBestScore.value, ctx.score.value);
      const isNewRecord = timedBestScore.value > previousBest;
      if (timedBestScore.value > previousBest)
        triggerRecordConfetti();

      void trackEvent('game_finished', {
        mode: selectedMode.value,
        final_score: ctx.score.value,
        answered_count: answeredCount,
        correct_count: correctCount.value,
        rounds_count: rounds.value.length,
        accuracy,
        average_duration_ms: averageMs.value,
        best_before: previousBest,
        best_after: timedBestScore.value,
        is_new_record: isNewRecord,
        score_schema: 1,
      });
    } else {
      const previousBest = survivalBestAnswered.value;
      survivalBestAnswered.value = Math.max(survivalBestAnswered.value, ctx.answeredCount.value);
      const isNewRecord = survivalBestAnswered.value > previousBest;
      if (survivalBestAnswered.value > previousBest)
        triggerRecordConfetti();

      void trackEvent('game_finished', {
        mode: selectedMode.value,
        final_score: ctx.score.value,
        answered_count: answeredCount,
        correct_count: correctCount.value,
        rounds_count: rounds.value.length,
        accuracy,
        average_duration_ms: averageMs.value,
        best_before: previousBest,
        best_after: survivalBestAnswered.value,
        is_new_record: isNewRecord,
        score_schema: 1,
      });
    }
  });

  onUnmounted(() => countdown.stop());

  return {
    loading,
    errorMessage,
    selectedMode,
    currentIndex,
    selectedPos,
    revealAnswer,
    rounds,
    timedBestScore,
    survivalBestAnswered,
    currentWord,
    ctx,
    isFinished,
    modeText,
    correctCount,
    averageMs,
    getCorrectPosList,
    startGame,
    backToModeSelect,
    goToNextRound,
    onChoose,
    onRoundCardReady,
    init,
  };
}
