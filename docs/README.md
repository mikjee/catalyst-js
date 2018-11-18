## Catalyst

> An observable state-store for Javascript.

## What is it?

Catalyst makes state management easier by using Javascript proxies. It facilitates reactive access to a central state store (object), and allows validation and keeping track of all updates to it. Catalyst also enables distributing parts of the state to overlapping or separate concerns, while maintaining a common history.

## Features

- Navigate, access and update the store as an object tree.
- Validate changes to the store via Interceptors.
- React to changes via Observers.
- Fragment and distribute the store to separate concerns.
- Keep track and undo/redo your changes.

## What are you waiting for?

To start using it, all you need to do is install the NPM package `catalyst-js` and import the `Catalyst` class.

Then you can [create your state-store](create.md).
