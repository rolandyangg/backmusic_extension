// Maps `import ... from 'react-dom'` onto Spicetify's bundled ReactDOM (used for
// createPortal in CenterpieceEditor). Resolved lazily — see ./react.js.
const RD = () => window.Spicetify.ReactDOM;

export const createPortal = (...a) => RD().createPortal(...a);

export default new Proxy(
  {},
  {
    get: (_t, prop) => RD()[prop],
  },
);
