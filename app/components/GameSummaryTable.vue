<script setup lang="ts">
import type { ColumnDef, ColumnFiltersState, FilterFn } from '@tanstack/vue-table';
import type { Pos } from '~/utils/data';
import type { GameResult } from '~/utils/game';
import { refManualReset } from '@vueuse/core';
import { getCorrectPosList } from '~/utils/history';

const props = defineProps<{
  rows: GameResult['rounds']
}>();

// Add round numbers to the data
type RoundResultRow = (GameResult['rounds'][number]) & { roundNumber: number };

const rowsWithNumbers = computed(() =>
  props.rows.map((round, index) => ({
    ...round,
    roundNumber: index + 1,
  } as RoundResultRow)),
);

const selectedPosFilter = refManualReset<'*' | '1' | '2' | '3'>('*');
const answerFilter = refManualReset<'*' | 'correct' | 'wrong' | 'unanswered'>('*');
const maxFrequency = refManualReset<number | '' | undefined>(undefined);

const posFilterOptions = [
  { label: '词性', value: '*' },
  { label: 'm. (der)', value: '1' },
  { label: 'n. (das)', value: '2' },
  { label: 'f. (die)', value: '3' },
];

const answerFilterOptions = [
  { label: '状态', value: '*' },
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

const answerMatchFilter: FilterFn<RoundResultRow> = (row, _, value: '*' | 'correct' | 'wrong' | 'unanswered') => {
  if (value === '*')
    return true;
  return getResultState(row.original) === value;
};

const containsPosFilter: FilterFn<RoundResultRow> = (row, _, value: '*' | '1' | '2' | '3') => {
  if (value === '*')
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
      return formatPos(selectedPos);
    },
  },
  {
    id: 'correctPosList',
    header: '答案',
    filterFn: containsPosFilter,
    cell: ({ row }) => {
      const correctPosList = getCorrectPosList(row.original);
      return correctPosList.map(pos => formatPos(pos)).join(' / ');
    },
  },
  {
    id: 'resultState',
    accessorFn: row => getResultState(row),
    filterFn: answerMatchFilter,
    enableHiding: true,
    meta: {
      class: {
        th: 'hidden',
        td: 'hidden',
      },
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

function formatPos(value?: Pos) {
  if (value === 1)
    return 'm.';
  if (value === 2)
    return 'n.';
  if (value === 3)
    return 'f.';
  return '';
}

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
      <USelectMenu
        v-model="answerFilter"
        value-key="value"
        :items="answerFilterOptions"
      />
      <USelectMenu
        v-model="selectedPosFilter"
        value-key="value"
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
        <a
          :href="getDefinitionUrl(row.original.word)"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary hover:underline"
        >
          {{ row.original.word }}
        </a>
      </template>
    </UTable>
  </UCard>
</template>
