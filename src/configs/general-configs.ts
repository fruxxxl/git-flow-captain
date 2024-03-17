import { Logger } from '../logger';
import { ConfigSchema, TConfigSchema } from './config-schema';
import * as fs from 'fs';

export class GeneralConfigs {
  private constructor(
    private readonly rawConfigs: string,
    private readonly logger: Logger,
  ) {
    //
  }

  static FromFile(configPath: string, logger: Logger) {
    return new GeneralConfigs(fs.readFileSync(configPath, 'utf8'), logger);
  }

  parsedAndValidated(): TConfigSchema {
    try {
      const config = ConfigSchema.parse(JSON.parse(this.rawConfigs));
      return config;
    } catch (error) {
      this.logger.error('Error parsing config file');
      throw error;
    }
  }
}
