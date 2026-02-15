import type { Data, DbWordRow } from '~/workers/data';
import wordsMeta from '~/assets/data.meta.txt?raw';
import DataWorker from '~/workers/data.ts?worker';

export type Pos = 0 | 1 | 2 | 3;
export type { DbWordRow };

const LocalVersionKey = 'db-version';
let dataWorker: Worker | undefined, dataWorkerResponse: Data | undefined;

export function loadWords(): Promise<DbWordRow[]> {
  const localVersion = localStorage.getItem(LocalVersionKey);
  const shouldRefresh = localVersion !== wordsMeta;

  if (dataWorkerResponse && !shouldRefresh)
    return Promise.resolve(dataWorkerResponse.words);
  if (!dataWorker)
    dataWorker = new DataWorker();

  return new Promise((resolve, reject) => {
    dataWorker!.onerror = (ev) => {
      const e = new Error('无法启动数据加载线程');
      e.cause = ev;
      reject(e);
    };

    dataWorker!.onmessage = (e) => {
      if (e.data.words) {
        dataWorkerResponse = e.data;
        localStorage.setItem(LocalVersionKey, wordsMeta);
        resolve(dataWorkerResponse!.words);
      } else if (e.data.error) {
        reject(new Error(e.data.error));
      } else {
        reject(new Error('Failed to load words from worker'));
      }
    };

    dataWorker!.postMessage({ shouldRefresh });
  });
}
