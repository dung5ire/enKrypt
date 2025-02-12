import { RequestOptions, StoredData } from './types';
import BrowserStorage from '../common/browser-storage';
import { InternalStorageNamespace } from '@/types/provider';
import { keccak256 } from 'web3-utils';
const STORAGE_TTL = 1000 * 60 * 60 * 24;
const TIMESTAMP = 'timestamp';
const cacheFetch = async (
  options: RequestOptions,
  ttl: number = STORAGE_TTL,
) => {
  const storage = new BrowserStorage(InternalStorageNamespace.cacheFetch);
  const storagetimestamp = await storage.get(TIMESTAMP);
  if (
    storagetimestamp &&
    storagetimestamp[TIMESTAMP] + STORAGE_TTL < new Date().getTime()
  ) {
    await storage.clear();
    await storage.set(TIMESTAMP, { [TIMESTAMP]: new Date().getTime() });
  } else if (!storagetimestamp) {
    await storage.set(TIMESTAMP, { [TIMESTAMP]: new Date().getTime() });
  }
  const hash = keccak256(JSON.stringify(options));
  const cached: StoredData = await storage.get(hash);

  if (cached && cached.timestamp + ttl > new Date().getTime()) {
    return JSON.parse(cached.data);
  } else {
    const fetchOptions: {
      method?: string;
      headers?: Record<string, any>;
      body?: string;
    } = {};
    if (options.post) {
      fetchOptions.method = 'POST';
      fetchOptions.body = JSON.stringify(options.post);
    }
    if (options.headers) {
      fetchOptions.headers = options.headers;
    }
    return fetch(options.url, fetchOptions)
      .then(res => res.json())
      .then(json => {
        const jsondata = options.postProcess ? options.postProcess(json) : json;
        const jsonstring = JSON.stringify(jsondata);
        if (!json.error) {
          const store: StoredData = {
            timestamp: new Date().getTime(),
            data: jsonstring,
          };
          return storage.set(hash, store).then(() => jsondata);
        }
        return jsondata;
      });
  }
};

export default cacheFetch;
