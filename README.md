mobx-async-computed makes it possible to create mobx @computed-like functions (or observables) whose values are computed asynchronously (as oppose to standard mobx @computed functions, whose values MUST be computed synchronously).

### Motivation

Check https://github.com/mobxjs/mobx-utils/issues/90 to understand the initial motivation for this library.

### STATUS of this project

These utilities are used in production at [Solvvy]((https://solvvy.com/)) since more than 6 months for 2 large scale internal and external React web apps. However some work needs to be done to fully test this library in isolation and add more documentation etc.

TODOS
- [ ] improve docs a lot!
- [ ] publish to npm
- [ ] add a bunch of more tests and run them via CI
- [ ] maybe think of a different name to avoid confusion with @danielarwickers utility library (see Prior Art)

#### Caveats

Currently this is only used in production with mobx 3. May work with mobx 4 as well (not tested though).

### Prior Art

https://github.com/danielearwicker/computed-async-mobx essentially solves the same problem. The main differences are:
- mobx-async-computed (this project) tries to stay close to the simple API of `fromPromise` from the official https://github.com/mobxjs/mobx-utils package, whereas computed-async-mobx uses it's own unique API. One particular difference is how rejected Promises / Error states are propagated to the caller in both libraries.
- mobx-async-computed provides a combinator function `combineAsyncComputeds` to be able to await the computation of 2 or more computes easily (similar to `Promise.all`)
- @danielarwicker's computed-async-mobx has built-in trottling functionality to avoid running expensive computations too often when using async-computed values across different call stacks.