import type { Encodable } from '@/types/encoding';

export class Step implements Encodable<StepData> {
  readonly identifier: string;
  readonly label: string;

  private _active: boolean;
  private _completed: boolean;
  private _errorMessage: string | undefined;

  constructor(data: StepData) {
    this.identifier = data.identifier;
    this.label = data.label;
    this._active = data.active ?? false;
    this._completed = data.completed ?? false;
    this._errorMessage = data.errorMessage;
  }

  /**
   * Convenience function to instantiate a step more easily.
   * The constructor must follow some type restriction and therefore can't be
   * beautified.
   */
  static new(identifier: string, label: string): Step {
    return new this({ identifier, label });
  }

  get active(): boolean {
    return this._active;
  }

  /**
   * Signals that a step has been successfully completed.
   */
  get completed(): boolean {
    return this._completed;
  }

  get failed(): boolean {
    return this.errorMessage !== undefined;
  }

  /**
   * Signals that a step has either completed successfully or failed with an
   * error.
   */
  get done(): boolean {
    return !this.active && (this.completed || this.failed);
  }

  get errorMessage(): string | undefined {
    return this._errorMessage;
  }

  public activate(): void {
    if (!this.active && !this.done) {
      this._active = true;
    } else {
      throw new Error('Tried to activate already active or finished step!');
    }
  }

  public deactivate(): void {
    if (this.active) {
      this._active = false;
    } else {
      throw new Error('Can not deactivate not active step!');
    }
  }

  public complete(): void {
    if (!this.done) {
      this._completed = true;
    } else {
      throw new Error('Can not complete already completed or failed step!');
    }
  }

  public setErrorMessage(message: string): void {
    if (message === undefined) {
      // This ensures that the `failed` getter works reliably.
      throw new Error('Can not unset error of step!');
    } else if (!this.done) {
      this._errorMessage = message;
    } else {
      throw new Error('Can not set error of an already completed or failed step!');
    }
  }

  public encode(): StepData {
    return {
      identifier: this.identifier,
      label: this.label,
      active: this.active,
      completed: this.completed,
      errorMessage: this.errorMessage,
    };
  }
}

export type StepData = {
  identifier: string;
  label: string;
  active?: boolean;
  completed?: boolean;
  errorMessage?: string;
};
