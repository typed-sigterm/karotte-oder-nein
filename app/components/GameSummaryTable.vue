<script setup lang="ts">
import type { ColumnDef, ColumnFiltersState, FilterFn } from '@tanstack/vue-table';
import type { Pos } from '~/utils/data';
import type { GameResult, PosString } from '~/utils/game';
import { getCorrectPosList } from '~/utils/history';

const props = defineProps<{
  rows: GameResult['rounds']
}>();

const ShortPosMap: Record<Pos, string> = {
  0: '',
  1: 'm.',
  2: 'n.',
  3: 'f.',
};

const LongPosMap: Record<Pos, string> = {
  0: '',
  1: 'der',
  2: 'das',
  3: 'die',
};

// Add round numbers to the data
type RoundResultRow = (GameResult['rounds'][number]) & { roundNumber: number };

const rowsWithNumbers = computed(() =>
  props.rows.map((round, index) => ({
    ...round,
    roundNumber: index + 1,
  } as RoundResultRow)),
);

const selectedPosFilter = ref<PosString>();
const answerFilter = ref<undefined | 'correct' | 'wrong' | 'unanswered'>('wrong');
const maxFrequency = ref<number | ''>();

const posFilterOptions = [
  { label: 'm. (der)', value: '1' },
  { label: 'n. (das)', value: '2' },
  { label: 'f. (die)', value: '3' },
];

const answerFilterOptions = [
  { label: '仅答对', value: 'correct' },
  { label: '仅答错', value: 'wrong' },
  { label: '仅未作答', value: 'unanswered' },
];

// Helper function to determine result state
function getResultState(round: GameResult['rounds'][number]): 'correct' | 'wrong' | 'unanswered' {
  if (!('selectedPos' in round) || round.selectedPos == null)
    return 'unanswered';

  const correctPosList = getCorrectPosList(round);
  return correctPosList.includes(round.selectedPos) ? 'correct' : 'wrong';
}

const answerMatchFilter: FilterFn<RoundResultRow> = (row, _, value?: 'correct' | 'wrong' | 'unanswered') => {
  if (!value)
    return true;
  return getResultState(row.original) === value;
};

const containsPosFilter: FilterFn<RoundResultRow> = (row, _, value?: PosString) => {
  if (!value)
    return true;
  const wanted = Number(value) as Pos;
  const correctPosList = getCorrectPosList(row.original);
  return correctPosList.includes(wanted);
};

const maxFrequencyFilter: FilterFn<RoundResultRow> = (row, _, value?: number) => {
  return value == null
    ? true
    : row.original.frequency <= value;
};

const columns: ColumnDef<RoundResultRow>[] = [
  { accessorKey: 'roundNumber', header: '#' },
  { accessorKey: 'word', header: '单词' },
  {
    accessorKey: 'frequency',
    header: '词频排位',
    filterFn: maxFrequencyFilter,
  },
  {
    accessorKey: 'selectedPos',
    header: '作答',
    cell: ({ row }) => {
      const selectedPos = 'selectedPos' in row.original ? row.original.selectedPos as Pos | undefined : undefined;
      return selectedPos ? ShortPosMap[selectedPos] : '';
    },
  },
  {
    id: 'correctPosList',
    header: '答案',
    filterFn: containsPosFilter,
    meta: {
      class: { th: 'hidden', td: 'hidden' },
    },
  },
  {
    id: 'resultState',
    accessorFn: row => getResultState(row),
    filterFn: answerMatchFilter,
    meta: {
      class: { th: 'hidden', td: 'hidden' },
    },
  },
  {
    id: 'duration',
    header: '耗时',
    cell({ row }) {
      if (!('duration' in row.original))
        return '';
      return `${((row.original.duration as number) / 1000).toFixed(1)}s`;
    },
  },
];

const columnFilters = computed<ColumnFiltersState>(() => {
  const filters: ColumnFiltersState = [];
  const normalizedMaxFrequency = typeof maxFrequency.value === 'number' && Number.isFinite(maxFrequency.value)
    ? maxFrequency.value
    : undefined;

  filters.push({ id: 'resultState', value: answerFilter.value });
  filters.push({ id: 'correctPosList', value: selectedPosFilter.value });

  if (normalizedMaxFrequency != null)
    filters.push({ id: 'frequency', value: normalizedMaxFrequency });

  return filters;
});

function getArticle(row: RoundResultRow) {
  return Object.entries(row.verdictMap)
    .filter(([_, isCorrect]) => isCorrect)
    .map(([posString]) => (LongPosMap as any)[posString])
    .join('/');
}

function getDefinitionUrl(word: string) {
  return `https://www.godic.net/dicts/de/${encodeURIComponent(word)}`;
}
</script>

<template>
  <UCard :ui="{ header: 'flex' }">
    <template #header>
      <div class="font-semibold">
        题目详情
      </div>
      <div class="text-muted text-sm flex items-center gap-1 ml-auto">
        <UIcon name="i-lucide-info" />
        <span class="align-middle">
          点击单词可查看释义
        </span>
      </div>
    </template>

    <UFieldGroup>
      <UBadge
        class="text-muted"
        color="neutral"
        variant="outline"
        icon="i-lucide-filter"
      />
      <USelectMenu
        v-model="answerFilter"
        :search-input="false"
        value-key="value"
        clear
        placeholder="状态"
        :items="answerFilterOptions"
      />
      <USelectMenu
        v-model="selectedPosFilter"
        :search-input="false"
        value-key="value"
        clear
        placeholder="正确词性"
        :items="posFilterOptions"
      />
      <UInput
        v-model.number="maxFrequency"
        type="number"
        placeholder="按最大词频排位筛选"
      />
    </UFieldGroup>

    <UTable
      :data="rowsWithNumbers"
      :columns="columns"
      :column-filters="columnFilters"
      :ui="{ th: 'whitespace-nowrap' }"
      class="max-h-[50vh] overflow-auto"
    >
      <template #word-cell="{ row }">
        {{ getArticle(row.original) }}
        <ULink
          :href="getDefinitionUrl(row.original.word)"
          target="_blank"
        >
          {{ row.original.word }}
        </ULink>
      </template>
    </UTable>
  </UCard>
</template>
