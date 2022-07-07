import type { Encodable } from '@/types/encoding';

/**
 * A step is a metadata container that gets associated with an executable.
 *
 * A step maintains data that is associated with a specific execution of an
 * executable (typically a function). It holds information like if it is
 * currently active, already completed, if it has failed and if so with which
 * error. On top of that it adds some logic that ensures the strict life-cycle
 * of a step. This means the combination of a step and an executable can only
 * run once.
 *
 * The purpose to associate a step with an executable can be diverse. Commonly
 * it is used to observe, visualize and preserve the progress of an action that
 * can consist of multiple of such steps.
 *
 * As steps are intended to be preserved to storage and get reloaded, it must
 * follow the rules of encodable data. Therefore a step MUST NOT save any
 * references to executables as they can not be serialized. Furthermore this
 * separates logic and data properly.
 *
 * Steps are an important part for backwards compatibility of actions for the
 * core business logic of the application. Thereby they MUST ALWAYS be
 * optionally extended and NEVER introduce breaking changes to itself. Tests are
 * an approach to ensure this.
 */
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
   * The constructor must follow type restriction for encoding and therefore
   * can't be beautified.
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
