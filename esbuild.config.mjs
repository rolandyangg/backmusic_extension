// Bundles the custom app to dist/index.js as an ESM module whose default export is the
// route component (Spicetify's custom-app contract). React/ReactDOM are aliased to
// Spicetify's globals (src/shims), and JSX compiles to Spicetify.React.createElement, so
// no React is bundled. CSS imports are injected as <style> tags at runtime.
import esbuild from 'esbuild';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

// Turns each `import './x.css'` into JS that injects the CSS text as a <style> (deduped).
// More reliable than relying on Spicetify to auto-load a sidecar stylesheet.
const cssInject = {
  name: 'css-inject',
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async (args) => {
      const css = await readFile(args.path, 'utf8');
      const id = 'bm-css-' + path.basename(args.path);
      const contents = `
        (() => {
          if (typeof document === 'undefined') return;
          if (document.getElementById(${JSON.stringify(id)})) return;
          const el = document.createElement('style');
          el.id = ${JSON.stringify(id)};
          el.textContent = ${JSON.stringify(css)};
          document.head.appendChild(el);
        })();
      `;
      return { contents, loader: 'js' };
    });
  },
};

const options = {
  entryPoints: [path.join(__dirname, 'src/app.jsx')],
  bundle: true,
  // Output to the repo root so the root is a ready-to-use Spicetify app folder (manifest.json
  // + index.js side by side) — the layout the Marketplace and a manual install expect.
  outfile: path.join(__dirname, 'index.js'),
  // Spicetify loads a custom app's index.js as a CLASSIC SCRIPT (not a module), then
  // calls a top-level global `render()`. So we emit an IIFE on a global (`backmusic`) and
  // append `const render = () => backmusic.default()` — mirroring the marketplace app.
  // (ESM `export default` would be a syntax error in a classic script → app fails to load.)
  format: 'iife',
  globalName: 'backmusic',
  footer: { js: 'const render = () => backmusic.default();' },
  target: 'es2020',
  jsx: 'transform',
  jsxFactory: 'Spicetify.React.createElement',
  jsxFragment: 'Spicetify.React.Fragment',
  alias: {
    react: path.join(__dirname, 'src/shims/react.js'),
    'react-dom': path.join(__dirname, 'src/shims/react-dom.js'),
  },
  loader: { '.js': 'jsx' },
  plugins: [cssInject],
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('watching…');
} else {
  await esbuild.build(options);
}
