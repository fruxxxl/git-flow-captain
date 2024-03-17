// import prompts from 'prompts';

// export class PrProviderList {
//   public static providers: IPrProvider[] = [GithubPrProvider];
// }

// export class TasksList {
//   constructor(public readonly tasks: Task[]) {
//     //
//   }

//   async chooseTaskInteractive() {
//     const onCancel = () => {
//       console.log('Operation cancelled');
//       process.exit(0);
//     };

//     const { taskName } = await prompts(
//       {
//         type: 'select',
//         name: 'taskName',
//         message: 'Which task would you like to execute?',
//         choices: this.tasks.map((task) => ({ title: task.title, value: task.name })),
//         validate: (value) => (value.length > 0 ? true : 'You must select a task'),
//       },
//       { onCancel },
//     );

//     const task = this.tasks.find((t) => t.name === taskName);
//     if (!task) {
//       throw new Error(`Task with name "${taskName}" not found`);
//     }

//     return task;
//   }
// }
