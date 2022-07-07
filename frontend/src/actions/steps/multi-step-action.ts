import type { Step } from './step';

/**
 * A multi-step action aggregates multiple steps allows to execute them.
 *
 * An action acts as extension of steps to make them more usable in compounds.
 * Therefore it provides convenient getters that aggregates metadata from all
 * steps as metadata for the whole action.
 *
 * Finally the action allows to associate each step with an executable and run
 * the whole action. Therefore it is important that the stored list of steps is
 * strictly ordered. The provision of the executables happens on execution. The
 * action ensures that there is an executable for each to run step.
 *
 * It is not possible to execute the same action twice in parallel or a second
 * time. But it is possible to continue the execution of a step sequence at
 * a later point in time. As there is no mechanism (yet) to actively stop the
 * execution, this is only relevant when the whole application quits during the
 * execution of the action. After reloading the encoded data of the action, it
 * is possible to continue the execution from the last completed step on. Note
 * that in this case it is not necessary to provide the executables of already
 * completed steps.
 * Thereby the association of steps data with their logic to execute always
 * happens during runtime. In result actions do not provide any further
 * guarantees of backwards compatibility by themselves, but allows to do so in
 * a quite flexible manner by using actions. As an action can always become
 * interrupted it is necessary to maintain executables for old steps that get
 * loaded from the users storage. Though it is possible to adapt the actual
 * internal implementation.
 *
 * The multi-step action class is meant to get extended as a specific action.
 *
 * As actions are intended to be preserved to storage and get reloaded, it must
 * follow the rules of encodable data. Therefore an action MUST NOT save any
 * references to executables as they can not be serialized. Furthermore this
 * separates logic and data properly.
 *
 * Actions are an important part for backwards compatibility for the core
 * business logic of the application. Thereby they MUST ALWAYS be optionally
 * extended and NEVER introduce breaking changes to itself. Tests are an approach
 * to ensure this.
 */
export class MultiStepAction {
  readonly _steps: Array<Step>;

  constructor(steps: Array<Step>) {
    this._steps = steps;
  }

  get steps(): Array<Step> {
    return this._steps;
  }

  /**
   * Signals that any step is currently in progress.
   */
  get active(): boolean {
    return this.steps.some((step) => step.active);
  }

  /**
   * Signals that all steps have successfully completed.
   */
  get completed(): boolean {
    return this.steps.every((step) => step.completed);
  }

  /**
   * Signals that any step has failed with an error.
   */
  get failed(): boolean {
    return this.steps.some((step) => step.failed);
  }

  /**
   * Signals that either all steps have completed successfully or any step has
   * failed with an error.
   */
  get done(): boolean {
    return !this.active && (this.failed || this.completed);
  }

  get errorMessage(): string | undefined {
    for (const step of this.steps) {
      if (step.failed) {
        return step.errorMessage;
      }
    }
  }

  protected async executeSteps(methods: Record<string, CallableFunction>): Promise<void> {
    if (this.failed) {
      throw new Error('Attempt to run already failed action!');
    }

    if (this.active) {
      throw new Error('Attempt to run already in progress action!');
    }

    const notCompletedSteps = getNotCompletedSteps(this.steps);
    const stepsWithMissingMethod = findStepsWithMissingMethod(notCompletedSteps, methods);

    if (stepsWithMissingMethod.length > 0) {
      throw new Error(
        'Can not (continue) execution of action. ' +
          `Missing methods for steps: ${stepsWithMissingMethod.map((step) => step.identifier)}`,
      );
    }

    for (const step of notCompletedSteps) {
      const method = methods[step.identifier];
      step.activate();

      try {
        await method();
        step.complete();
      } catch (error) {
        step.setErrorMessage((error as { message?: string }).message ?? 'Unknown failure!');
        throw error;
      } finally {
        step.deactivate();
      }
    }
  }
}

function getNotCompletedSteps(steps: Array<Step>): Array<Step> {
  return steps.filter((step) => !step.completed);
}

function findStepsWithMissingMethod(
  steps: Array<Step>,
  methods: Record<string, CallableFunction>,
): Array<Step> {
  return steps.filter((step) => methods[step.identifier] === undefined);
}
