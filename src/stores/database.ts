import { proxy } from 'valtio';

export const $dbList = proxy({
  count: 0,
  displayName: 'foo',
  databases: {},

  inc() {
    ++this.count;
  },
  setName(name: string) {
    this.displayName = name;
  },
});
