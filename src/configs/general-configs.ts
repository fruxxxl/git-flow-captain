import { ILogger } from 'src/types';
import { ConfigSchema, TGeneralConfig } from './config-schema';
import * as fs from 'fs';

export class GeneralConfigs {
  private constructor(
    private readonly rawConfigs: string,
    private readonly logger: ILogger,
  ) {
    //
  }

  static FromFile(configPath: string, logger: ILogger) {
    return new GeneralConfigs(fs.readFileSync(configPath, 'utf8'), logger);
  }

  parsedAndValidated(): TGeneralConfig {
    try {
      const config = ConfigSchema.parse(JSON.parse(this.rawConfigs));
      return config;
    } catch (error) {
      this.logger.error('Error parsing config file');
      throw error;
    }
  }
}
