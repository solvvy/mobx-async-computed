import { action, computed, observable } from 'mobx';
import { fromPromise, IPromiseBasedObservable, FULFILLED, PENDING, REJECTED, PromiseState } from 'mobx-utils';

export type IBaseAsyncComputed<T> = {
  mapSync<O>(mapFn: (input: T) => O): IAsyncComputed<O>;
  refresh(): void;
  case<U>(handlers: { pending?: () => U; fulfilled?: (t: T) => U; rejected?: (e: any) => U }): U;
};

export interface IPendingAsyncComputed<T> extends IBaseAsyncComputed<T> {
  readonly state: 'pending';
  readonly pending: true;
  readonly rejected: false;
  readonly fulfilled: false;
}

export interface IRejectedAsyncComputed<T> extends IBaseAsyncComputed<T> {
  readonly state: 'rejected';
  readonly pending: false;
  readonly rejected: true;
  readonly fulfilled: false;
  readonly error: any;
}

export interface IFulfilledAsyncComputed<T> extends IBaseAsyncComputed<T> {
  readonly state: 'fulfilled';
  readonly pending: false;
  readonly rejected: false;
  readonly fulfilled: true;
  readonly value: T;
}

export type IAsyncComputed<T> = IPendingAsyncComputed<T> | IFulfilledAsyncComputed<T> | IRejectedAsyncComputed<T>;

abstract class AbstractAsyncComputed<T> {
  abstract state: PromiseState;
  error;
  value;

  @computed
  get pending() {
    return this.state === PENDING;
  }

  @computed
  get rejected() {
    return this.state === REJECTED;
  }

  @computed
  get fulfilled() {
    return this.state === FULFILLED;
  }

  // TODO move this combinator to AbstractAsyncComputed perhaps
  mapSync<O>(mapFn: (input: T) => O): IAsyncComputed<T> {
    return new DerivedAsyncComputed(this as any, mapFn) as any;
  }

  // TODO this to AbstractAsyncComputed
  case(handlers: { pending; fulfilled; rejected }) {
    switch (this.state) {
      case PENDING:
        return handlers.pending && handlers.pending();
      case REJECTED:
        return handlers.rejected && handlers.rejected(this.error);
      case FULFILLED:
        return handlers.fulfilled && handlers.fulfilled(this.value);
    }
  }
}

class AsyncComputed<T> extends AbstractAsyncComputed<T> {
  @observable private refreshCallCount = 0;

  constructor(private readonly computeFn: () => PromiseLike<T>) {
    super();
  }

  @computed
  get state() {
    return this._internalObservable.state;
  }

  @computed
  get value() {
    if (this._internalObservable.state === FULFILLED) {
      return this._internalObservable.value;
    } else {
      return undefined;
    }
  }

  @computed
  get error() {
    if (this._internalObservable.state === REJECTED) {
      return this._internalObservable.value;
    } else {
      return undefined;
    }
  }

  @action.bound
  refresh() {
    this.refreshCallCount++;
  }

  case(caseImpl) {
    return this._internalObservable.case(caseImpl);
  }

  @computed
  private get _internalObservable(): IPromiseBasedObservable<T> {
    this.refreshCallCount;
    const observablePromise = fromPromise(this.computeFn());
    // handle rejections etc. because they'll otherwise bubble up and crash node.js
    (observablePromise as any).catch(e => undefined);
    return observablePromise;
  }
}

const PASS_THROUGH_PROPS = ['pending', 'refresh', 'error', 'state'];

class DerivedAsyncComputed<T, O> extends AbstractAsyncComputed<O> {
  state;
  error;
  constructor(private readonly baseAsyncComputed: IAsyncComputed<T>, private derivationFn: (input: T) => O) {
    super();
    PASS_THROUGH_PROPS.forEach(prop => {
      Object.defineProperty(this, prop, {
        enumerable: true,
        configurable: true,
        get() {
          return baseAsyncComputed[prop];
        }
      });
    });
  }

  @computed
  get value() {
    return this.baseAsyncComputed.fulfilled ? this.derivationFn(this.baseAsyncComputed.value) : undefined;
  }

  case(handlers: { pending; fulfilled; rejected }) {
    switch (this.state) {
      case PENDING:
        return handlers.pending && handlers.pending();
      case REJECTED:
        return handlers.rejected && handlers.rejected(this.error);
      case FULFILLED:
        return handlers.fulfilled && handlers.fulfilled(this.value);
    }
  }
}

class CombinedAsyncComputed<T> extends AbstractAsyncComputed<T> {
  constructor(private asyncComputeds: AsyncComputed<any>[]) {
    super();
  }

  @computed
  get state() {
    const allComputeds = this.asyncComputeds;
    if (allComputeds.some(computed => computed.rejected)) {
      return REJECTED;
    } else if (allComputeds.every(computed => computed.fulfilled)) {
      return FULFILLED;
    } else {
      return PENDING;
    }
  }

  @action.bound
  refresh() {
    this.asyncComputeds.forEach(asyncComputeds => asyncComputeds.refresh());
  }

  @computed
  get value() {
    return this.asyncComputeds.every(computed => computed.fulfilled)
      ? this.asyncComputeds.map(computed => computed.value)
      : undefined;
  }

  @computed
  get error() {
    const erroredComputed = this.asyncComputeds.find(computed => computed.error);
    if (erroredComputed) {
      return erroredComputed.error;
    } else {
      return undefined;
    }
  }
}

//TODO add overloads for more combinations

export function combineAsyncComputeds<T1, T2>(
  asyncComputed1: IAsyncComputed<T1>,
  asyncComputed2: IAsyncComputed<T2>
): IAsyncComputed<[T1, T2]>;
export function combineAsyncComputeds(...asyncComputeds) {
  return new CombinedAsyncComputed(asyncComputeds) as any;
}

export default function asyncComputed<T>(computeFn: () => PromiseLike<T>) {
  return new AsyncComputed(computeFn) as IAsyncComputed<T>;
}
