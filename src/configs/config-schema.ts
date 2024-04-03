import { PullRequestProvider } from '../types';
import { z } from 'zod';

const SubmoduleConfigSchema = z.object({
  name: z.string(),
  baseBranch: z.string(),
  remoteName: z.string(),
  remoteUrl: z.string(),
  repositoryId: z.string(),
});

const ProjectConfigSchema = z.object({
  name: z.string(),
  repositoryId: z.string(),
  path: z.string(),
  baseBranch: z.string(),
  remoteName: z.string(),
  remoteUrl: z.string(),
  submodules: z.array(SubmoduleConfigSchema),
});

const PrProviderSchema = z.object({
  provider: z.nativeEnum(PullRequestProvider),
  project: z.string(),
  organization: z.string(),
  host: z.string(),
});

export const ConfigSchema = z.object({
  prProviders: z.array(PrProviderSchema),
  projects: z.array(ProjectConfigSchema),
});

export type TGeneralConfig = z.infer<typeof ConfigSchema>;
export type TProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type TSubmoduleConfig = z.infer<typeof SubmoduleConfigSchema>;
export type TPrProvider = z.infer<typeof PrProviderSchema>;
