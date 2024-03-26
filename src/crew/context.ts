import { ETaskName } from '@tasks/types';
import { ILogger } from '../types';

type TKey = 'projectConfigs';

export interface IContext {
  get<T>(key: TKey): T;
  set<T>(key: TKey, value: T): void;
}

export class Context implements IContext {
  private storage: Record<string, unknown> = {};

  constructor(
    private readonly task: ETaskName,
    private readonly logger: ILogger,
  ) {
    //
  }

  get<T>(key: TKey): T {
    const value = this.storage[key];
    if (value === undefined) {
      throw new Error(`Key ${key} not found in context for task "${this.task}"`);
    }
    return value as T;
  }

  set<T>(key: TKey, value: T): void {
    this.storage[key] = value;
    this.logger.info(`Updated context for task "${this.task}" with key "${key}"`);
  }
}
