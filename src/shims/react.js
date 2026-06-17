// Maps bare `import ... from 'react'` onto Spicetify's bundled React, so the copied
// components don't ship a second copy of React (avoids dual-React hook errors). Resolved
// lazily at call time — Spicetify injects its globals before custom apps run.
const R = () => window.Spicetify.React;

export const useState = (...a) => R().useState(...a);
export const useEffect = (...a) => R().useEffect(...a);
export const useRef = (...a) => R().useRef(...a);
export const useCallback = (...a) => R().useCallback(...a);
export const useMemo = (...a) => R().useMemo(...a);
export const useContext = (...a) => R().useContext(...a);
export const createElement = (...a) => R().createElement(...a);

export default new Proxy(
  {},
  {
    get: (_t, prop) => R()[prop],
  },
);
