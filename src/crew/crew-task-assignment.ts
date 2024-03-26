import { ETaskName } from '../tasks/types';
import { Task } from '../tasks/task';
import { IContext } from './context';

export class CrewTaskAssignment {
  constructor(
    public readonly map: {
      [key in ETaskName]: {
        responsibles: string[];
        context: IContext;
      };
    },
  ) {
    //
  }

  forTask(task: Task) {
    const crewTaskAssignment = this.map[task.name];
    if (!crewTaskAssignment?.responsibles?.length) {
      throw new Error(`Responsibles for task ${task.name} not found`);
    }

    return crewTaskAssignment;
  }
}
