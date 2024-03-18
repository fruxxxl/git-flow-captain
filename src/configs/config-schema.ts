import { PullRequestProvider } from '../types';
import { z } from 'zod';

const SubmoduleConfigSchema = z.object({
  name: z.string(),
  baseBranch: z.string(),
  remote: z.string(),
});

const ProjectConfigSchema = z.object({
  name: z.string(),
  repositoryId: z.string(),
  path: z.string(),
  baseBranch: z.string(),
  remote: z.string(),
  submodules: z.array(SubmoduleConfigSchema),
});

const PrProviderSchema = z.object({
  provider: z.enum([PullRequestProvider.AzureDevOps]),
  project: z.string(),
  organization: z.string(),
});

export const ConfigSchema = z.object({
  prProviders: z.array(PrProviderSchema),
  projects: z.array(ProjectConfigSchema),
});

export type TConfigSchema = z.infer<typeof ConfigSchema>;
export type TProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type TSubmoduleConfig = z.infer<typeof SubmoduleConfigSchema>;
export type TPrProvider = z.infer<typeof PrProviderSchema>;
