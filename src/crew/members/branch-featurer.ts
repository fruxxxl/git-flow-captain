import { TPrProvider, TProjectConfig } from '../../configs/config-schema';

import { Logger } from '../../logger';
import { AbstractCrewMember } from './abstract-crew-member';

export class BranchFeaturer extends AbstractCrewMember {
  constructor(
    private readonly projectConfigs: TProjectConfig[],
    private readonly prProviders: TPrProvider[],
    private readonly logger: Logger,
  ) {
    super();
  }

  public async execute() {
    throw new Error('Not implemented.');
  }
}
