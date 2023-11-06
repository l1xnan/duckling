import {
  CompletionContext,
  CompletionSource,
  autocompletion,
  completeFromList
} from '@codemirror/autocomplete';
export function sqlCompletions(context: CompletionContext) {
  const word = context.matchBefore(/\w*/);
  if (word?.from == word?.to && !context.explicit) {
    return null;
  }
  return {
    from: word?.from,
    options: [
      { label: 'match', type: 'keyword' },
      { label: 'hello', type: 'variable', info: '(World)' },
      { label: 'magic', type: 'text', apply: '⠁⭒*.✩.*⭒⠁', detail: 'macro' },
    ],
  };
}

const completion: CompletionSource = (
  ctx: CompletionContext,
): CompletionContext => {
  return {
    options: [
      {
        lable: 'apple',
      },
    ],
  };
};
const myComplete = autocompletion({
  override: [completeFromList(['apple'])],
});
