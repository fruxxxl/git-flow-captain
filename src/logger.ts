import ora from 'ora';

export class Logger {
  private constructor(private readonly logPrefix: string = '') {
    //
  }

  static Default() {
    return new Logger();
  }

  static Prefixed(prefix: string) {
    return new Logger(`[${prefix}]`);
  }

  extendPrefix(prefix: string) {
    return new Logger(`${this.logPrefix} ${prefix}`);
  }

  makeAwaiting(message: string) {
    return ora(`${this.logPrefix} ${message}`).start();
  }

  successAwaiting(message: string, awaitedOra: ora.Ora) {
    return awaitedOra.succeed(message ? `${this.logPrefix} ${message}` : '');
  }

  failAwaiting(message: string, awaitedOra: ora.Ora) {
    return awaitedOra.fail(message ? `${this.logPrefix} ${message}` : '');
  }

  warnAwaiting(message: string, awaitedOra: ora.Ora) {
    return awaitedOra.warn(message ? `${this.logPrefix} ${message}` : '');
  }

  get prefix() {
    return this.logPrefix;
  }

  public info(message: string) {
    ora(`${this.logPrefix} ${message}`).info();
  }

  public warn(message: string) {
    ora(`${this.logPrefix} ${message}`).warn();
  }

  public error(message: string) {
    ora(`${this.logPrefix} ${message}`).fail();
  }
}
