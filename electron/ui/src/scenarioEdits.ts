/** JSON edits relative to the draft the user was looking at. Arrays are atomic:
 * table rows and pipeline node order must retain their index relationships. */
export interface ScenarioEdit {
  path: string[];
  value?: any;
  remove?: boolean;
}

export const copyScenario = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const isObject = (value: any): boolean => value !== null && typeof value === 'object' && !Array.isArray(value);

export function scenarioEdits(before: any, after: any, path: string[] = []): ScenarioEdit[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (isObject(before) && isObject(after)) {
    return Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).flatMap(key => {
      // Revisions and validation belong to the server, never to a queued edit.
      if (!path.length && ['input_revision', 'validation'].includes(key)) return [];
      if (!Object.prototype.hasOwnProperty.call(after, key)) return [{path: [...path, key], remove: true}];
      return scenarioEdits(before[key], after[key], [...path, key]);
    });
  }
  return [{path, value: copyScenario(after)}];
}

export function applyScenarioEdits<T>(scenario: T, edits: ScenarioEdit[]): T {
  let result = copyScenario(scenario);
  for (const edit of edits) {
    if (!edit.path.length) { result = copyScenario(edit.value); continue; }
    let target: any = result;
    for (const key of edit.path.slice(0, -1)) {
      if (!Object.prototype.hasOwnProperty.call(target, key) || !isObject(target[key])) {
        Object.defineProperty(target, key, {value: {}, enumerable: true, configurable: true, writable: true});
      }
      target = target[key];
    }
    const key = edit.path[edit.path.length - 1];
    if (edit.remove) delete target[key];
    else Object.defineProperty(target, key, {value: copyScenario(edit.value), enumerable: true, configurable: true, writable: true});
  }
  return result;
}
