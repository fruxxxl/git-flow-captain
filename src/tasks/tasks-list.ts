import prompts from 'prompts';
import { Task } from './task';
import { Logger } from '../logger';

export class TasksList {
  constructor(
    public readonly tasks: Task[],
    private readonly logger: Logger,
  ) {
    //
  }

  async chooseTaskInteractive() {
    const onCancel = () => {
      console.log('Operation cancelled');
      process.exit(0);
    };

    const { taskName } = await prompts(
      {
        type: 'select',
        name: 'taskName',
        message: `${this.logger.prefix} Which task would you like to execute?`,
        choices: this.tasks.map((task) => ({ title: task.title, value: task.name })),
        validate: (value) => (value.length > 0 ? true : 'You must select a task'),
      },
      { onCancel },
    );

    const task = this.tasks.find((t) => t.name === taskName);
    if (!task) {
      throw new Error(`Task with name "${taskName}" not found`);
    }

    return task;
  }
}
