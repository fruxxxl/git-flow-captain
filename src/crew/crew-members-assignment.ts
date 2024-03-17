import { ETaskName } from '../tasks/types';
import { Task } from '../tasks/task';

export class CrewMembersAssignment {
  constructor(
    public readonly map: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key in ETaskName]: string;
    },
  ) {}

  forTask(task: Task) {
    const crewMemberClassName = this.map[task.name];
    if (!crewMemberClassName) {
      throw new Error(`Executor for task ${task.name} not found`);
    }

    return crewMemberClassName;
  }
}
