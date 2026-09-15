export interface Dictionary<T extends string = string> {
  values: T[];
  indexByValue: Map<T, number>;
}

export function createDictionary<T extends string>(
  values: T[],
  initialValue?: T
): Dictionary<T> {
  const dictionary: T[] = [];
  const indexByValue = new Map<T, number>();

  if (initialValue !== undefined) {
    dictionary.push(initialValue);
    indexByValue.set(initialValue, 0);
  }

  for (const value of values) {
    if (!indexByValue.has(value)) {
      indexByValue.set(value, dictionary.length);
      dictionary.push(value);
    }
  }

  return { values: dictionary, indexByValue, };
}
