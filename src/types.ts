/* eslint-disable @typescript-eslint/no-explicit-any */
export enum PullRequestProvider {
  AzureDevOps = 'AzureDevOps',
}

export interface ILogger {
  extendPrefix(prefix: string): ILogger;
  makeAwaiting(message: string): any;
  successAwaiting(message: string, awaitedOra: any): void;
  failAwaiting(message: string, awaitedOra: any): void;
  warnAwaiting(message: string, awaitedOra: any): void;
  get prefix(): string;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}
