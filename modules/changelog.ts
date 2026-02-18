import type { components } from '@octokit/openapi-types';
import type { ChangelogItem } from '../shared/changelog';
import { addTemplate, addTypeTemplate, defineNuxtModule, useLogger } from '@nuxt/kit';
import { Octokit } from '@octokit/core';

const MAX_COMMIT = 5;

function extractAuthors(commit: components['schemas']['commit']) {
  const authors = commit.commit.message
    .split('\n')
    .filter(line => line.startsWith('Co-authored-by: '))
    .map(x => /^Co-authored-by: (.+) <.+>$/.exec(x)?.[1] || '')
    .filter(Boolean);
  if (commit.author?.name || commit.author?.login)
    authors.unshift(commit.author.name || commit.author.login);
  if (commit.committer?.name || commit.committer?.login)
    authors.push(commit.committer.name || commit.committer.login);
  return authors;
}

function extractChangeType(message: string) {
  const firstLine = message.split('\n')[0] || '';
  return /^(\w+)(?:\(\w+\))?:/.exec(firstLine)?.[1] || 'chore';
}

function extractTitle(message: string) {
  const firstLine = message.split('\n')[0] || '';
  return /^\w+(?:\(\w+\))?: (.+)$/.exec(firstLine)?.[1] || firstLine;
}

function extractDescription(message: string) {
  const lines = message.split('\n');
  if (lines.length <= 1)
    return '';
  return lines
    .slice(1)
    .filter(line => !line.startsWith('Co-authored-by: '))
    .join('\n')
    .trim();
}

async function fetchChangelog(logger: ReturnType<typeof useLogger>) {
  const octokit = new Octokit();
  if (!import.meta.env.COMMIT_REF) {
    logger.warn('COMMIT_REF 环境变量未设置，无法获取提交数据');
    return [];
  }

  const { data } = await octokit.request('GET /repos/{owner}/{repo}/commits', {
    owner: 'typed-sigterm',
    repo: 'karotte-oder-nein',
    sha: import.meta.env.COMMIT_REF,
    per_page: MAX_COMMIT,
  });
  return data.map(item => ({
    id: item.sha,
    type: extractChangeType(item.commit.message),
    title: extractTitle(item.commit.message),
    description: extractDescription(item.commit.message),
    authors: extractAuthors(item),
    date: item.commit.committer?.date || '',
  }));
}

export default defineNuxtModule({
  meta: {
    name: 'changelog',
  },

  async setup(_, nuxt) {
    const logger = useLogger('changelog');
    let payload: ChangelogItem[] = [];
    try {
      payload = await fetchChangelog(logger);
    } catch (cause) {
      logger.error(new Error('获取提交数据失败', { cause }));
    }

    nuxt.options.alias['#changelog'] = addTemplate({
      filename: 'changelog.mjs',
      getContents: () => `export default ${JSON.stringify(payload, null, 2)}`,
    }).dst;

    addTypeTemplate({
      filename: 'types/changelog.d.ts',
      getContents: () => [
        'declare module "#changelog" {',
        '  import type { ChangelogItem } from "~/shared/changelog"',
        '  const x: ChangelogItem[]',
        '  export default x',
        '}',
      ].join('\n'),
    });
  },
});
