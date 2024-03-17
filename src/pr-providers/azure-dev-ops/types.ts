export interface ICreatePullRequestParams {
  repositoryId: string;
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description: string;
  reviewers?: { id: string }[];
}

export interface AzureCreatePullRequestResponse {
  repository: {
    id: string;
    name: string;
    url: string;
    project: {
      id: string;
      name: string;
      url: string;
      state: string;
      revision: number;
      visibility: string;
      lastUpdateTime: string;
    };
    size: number;
    remoteUrl: string;
    sshUrl: string;
    webUrl: string;
    isDisabled: boolean;
    isInMaintenance: boolean;
  };
  pullRequestId: number;
  codeReviewId: number;
  status: string;
  createdBy: {
    displayName: string;
    url: string;
    id: string;
    uniqueName: string;
    imageUrl: string;
    descriptor: string;
  };
  creationDate: string;
  title: string;
  description: string;
  sourceRefName: string;
  targetRefName: string;
  mergeStatus: string;
  isDraft: boolean;
  mergeId: string;
  lastMergeSourceCommit: {
    commitId: string;
    url: string;
  };
  lastMergeTargetCommit: {
    commitId: string;
    url: string;
  };
  reviewers: {
    reviewerUrl: string;
    vote: number;
    hasDeclined: boolean;
    isFlagged: boolean;
    displayName: string;
    url: string;
    id: string;
    uniqueName: string;
    imageUrl: string;
  }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  labels: any[]; // You can define a specific type for labels if needed
  url: string;
  _links: {
    self: {
      href: string;
    };
    repository: {
      href: string;
    };
    workItems: {
      href: string;
    };
    sourceBranch: {
      href: string;
    };
    targetBranch: {
      href: string;
    };
    statuses: {
      href: string;
    };
    sourceCommit: {
      href: string;
    };
    targetCommit: {
      href: string;
    };
    createdBy: {
      href: string;
    };
    iterations: {
      href: string;
    };
  };
  supportsIterations: boolean;
  artifactId: string;
}
