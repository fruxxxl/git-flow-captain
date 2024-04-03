export interface ICreateMergeRequestParams {
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description: string;
  repositoryId: string;
  assigneeId?: number;
  labels?: string[];
}
