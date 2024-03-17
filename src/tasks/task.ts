import { ETaskName } from './types';

export class Task {
  constructor(
    public readonly name: ETaskName,
    public readonly title: string,
  ) {
    if (!Object.values(ETaskName).includes(name)) {
      throw new Error(`Task with name "${name}" not regitered`);
    }
  }
}
