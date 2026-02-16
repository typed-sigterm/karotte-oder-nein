import type { Pos, WordData as Word } from '~/utils/data';
import type { GameContext, GameMode, GameResult, RoundResult } from '~/utils/game';
import { shuffle } from '@std/random';
import { refAutoReset, refManualReset, useCountdown, useLocalStorage, whenever } from '@vueuse/core';
import confetti from 'canvas-confetti';
import { getCorrectPosList as getRoundCorrectPosList, saveGameHistory } from '~/utils/history';
import { trackEvent } from './analytics';

const TimedSeconds = 60;
const SurvivalWrongPenaltyBase = 1.15;

export function useGame() {
  const sourceWords = ref<Word[]>([]);
  const words = ref<Word[]>([]);
  const loading = ref(true);
  const errorMessage = ref('');

  const selectedMode = ref<GameMode>();
  const currentIndex = refManualReset(0);
  const selectedPos = refManualReset<Pos | undefined>(undefined);
  const revealAnswer = refManualReset(false);
  const gameStartedAt = ref(0);
  const roundStartedAt = ref(0);
  const isTimedUp = ref(false);
  const pendingTimedRoundReady = ref(false);

  const rounds = ref<RoundResult[]>([]);
  const timedBestScore = useLocalStorage('best:timed', 0);
  const survivalBestAnswered = useLocalStorage('best:survival', 0);
  const finalResult = ref<GameResult>();

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
      answeredCount: computed(() => rounds.value.filter(item => 'selectedPos' in item).length),
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
  const correctCount = computed(() => rounds.value.filter((item) => {
    if (!('selectedPos' in item))
      return false;
    return getRoundCorrectPosList(item).includes(item.selectedPos as Pos);
  }).length);
  const averageMs = computed(() => {
    const answeredRounds = rounds.value.filter(item => 'duration' in item);
    if (!answeredRounds.length)
      return 0;
    const sum = answeredRounds.reduce((acc, row) => acc + row.duration, 0);
    return sum / answeredRounds.length;
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

  function cloneRoundResult(round: RoundResult): RoundResult {
    if ('selectedPos' in round) {
      return {
        word: round.word,
        frequency: round.frequency,
        verdictMap: { ...round.verdictMap },
        selectedPos: round.selectedPos,
        carrot: round.carrot,
        duration: round.duration,
      } as RoundResult;
    }

    return {
      word: round.word,
      frequency: round.frequency,
      verdictMap: { ...round.verdictMap },
    } as RoundResult;
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
    finalResult.value = undefined;
    ctx.score.reset();
    gameStartedAt.value = Date.now();
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
    finalResult.value = undefined;
    ctx.score.reset();
    gameStartedAt.value = 0;
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
    const previousWrongCount = rounds.value.filter((item) => {
      if (!('selectedPos' in item))
        return false;
      return !getRoundCorrectPosList(item).includes(item.selectedPos as Pos);
    }).length;
    const survivalWrongPenalty = Math.ceil(scoreDelta * SurvivalWrongPenaltyBase ** previousWrongCount);
    const delta = isCorrect
      ? scoreDelta
      : (selectedMode.value === 'survival' ? -survivalWrongPenalty : 0);

    addCarrot(delta);

    rounds.value.push({
      word: currentWord.value.word,
      frequency: currentWord.value.frequency,
      verdictMap: {
        1: correctPosList.includes(1),
        2: correctPosList.includes(2),
        3: correctPosList.includes(3),
      },
      selectedPos: pos as RoundResult['selectedPos'],
      carrot: delta,
      duration: durationMs,
    } as RoundResult);

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
    const hasAnsweredCurrentRound = rounds.value.length > currentIndex.value;
    if (unfinishedRound && selectedPos.value == null && !hasAnsweredCurrentRound) {
      const correctPosList = getCorrectPosList(unfinishedRound);
      rounds.value.push({
        word: unfinishedRound.word,
        frequency: unfinishedRound.frequency,
        verdictMap: {
          1: correctPosList.includes(1),
          2: correctPosList.includes(2),
          3: correctPosList.includes(3),
        },
      } as RoundResult);
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

      const startedAt = new Date(gameStartedAt.value || Date.now());
      const endedAt = new Date();
      void saveGameHistory(finalResult.value = {
        schema: 1,
        mode: 'timed',
        carrot: ctx.score.value,
        correct: correctCount.value,
        startedAt,
        endedAt,
        rounds: rounds.value.map(cloneRoundResult),
        historicalBestCarrot: previousBest,
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

      const startedAt = new Date(gameStartedAt.value);
      const endedAt = new Date();
      void saveGameHistory(finalResult.value = {
        schema: 1,
        mode: 'survival',
        carrot: ctx.score.value,
        correct: correctCount.value,
        startedAt,
        endedAt,
        rounds: rounds.value.map(cloneRoundResult),
        historicalBestCorrect: previousBest,
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
    finalResult,
    currentWord,
    ctx,
    isFinished,
    modeText,
    getCorrectPosList,
    startGame,
    backToModeSelect,
    goToNextRound,
    onChoose,
    onRoundCardReady,
    init,
  };
}
