import computedPromise, { IFulfilledAsyncComputed } from './asyncComputed';
import { when } from 'mobx';

it('can resolve asyncComputed with value', done => {
  const cPromise = computedPromise(() => Promise.resolve({ foo: 'bar' }));
  when(
    () => cPromise.fulfilled,
    () => {
      expect((cPromise as any).value).toEqual({ foo: 'bar' });
      done();
    }
  );
});

it('can retry / refresh', done => {
  let attempt = 0;
  const promisedComputed = computedPromise(() => {
    if (attempt === 0) {
      attempt++;
      return Promise.reject(new Error('some problem'));
    } else {
      return Promise.resolve('success');
    }
  });

  when(
    () => promisedComputed.rejected,
    () => {
      expect((promisedComputed as any).error.message).toEqual('some problem');
      promisedComputed.refresh();
      when(
        () => promisedComputed.fulfilled,
        () => {
          expect((promisedComputed as any).value).toEqual('success');
          done();
        }
      );
    }
  );
});
