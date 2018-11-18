## Install

Install the NPM package `catalyst-js` into your project. You can also use yarn for the same.

```bash
npm i --save catalyst-js
```

!> Cayalyst requires ES6 support and the package does not come with any dependencies to transpile it to ES5 code. That is left upto the developer.

Alternatively, you can include a link to the minified build using the below script tag. Catalyst is pretty light, and weighs ~6kB when minified and gzipped.

```html
<script type="module" src="https://raw.githubusercontent.com/badguppy/catalyst-js/master/build/catalyst.min.js"></script>
```

Note that when added as a script, we are using the MIME `type="module"` for ES6 import/export.

## Import

Import the `Catalyst` class into your code. All functionality is available via instantiating this class.

```javascript
import Catalyst from 'catalyst-js';
```

Great! Now we are ready to create our store.
