import type { TabData } from '../types';

export const selectWorkbenchTabs = <TState extends { tabs: TabData[] }>(state: TState): TabData[] => (
  state.tabs
);

const areTabMetadataFieldsEqual = (left: TabData, right: TabData): boolean => {
  if (Object.is(left, right)) return true;

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;

  for (const key of leftKeys) {
    if (!hasOwn(right, key) || !Object.is(left[key as keyof TabData], right[key as keyof TabData])) {
      return false;
    }
  }
  return true;
};

const hasOwn = (value: object, key: string): boolean => (
  Object.prototype.hasOwnProperty.call(value, key)
);

/**
 * Workbench chrome needs tab identity, order, and metadata. Compare every
 * current own field so future TabData fields opt in automatically instead of
 * being silently omitted from the render boundary.
 */
export const areWorkbenchTabsEqual = (
  left: TabData[],
  right: TabData[],
): boolean => {
  if (Object.is(left, right)) return true;
  if (left.length !== right.length) return false;

  for (let index = 0; index < left.length; index += 1) {
    if (!areTabMetadataFieldsEqual(left[index], right[index])) return false;
  }
  return true;
};

/** Creates a per-subscriber selector whose result stays referentially stable across equal updates. */
export const createWorkbenchTabsSelector = () => {
  let previousTabs: TabData[] | undefined;
  return <TState extends { tabs: TabData[] }>(state: TState): TabData[] => {
    if (
      previousTabs
      && areWorkbenchTabsEqual(previousTabs, state.tabs)
    ) {
      return previousTabs;
    }
    previousTabs = state.tabs;
    return state.tabs;
  };
};
