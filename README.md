# JagOBX Properties

Website for [jagobxproperties.com](https://jagobxproperties.com) - Outer Banks
vacation rentals, Corolla to Nags Head.

A single-page React app. Property photos are embedded directly in the source as
data URLs, which is why `src/App.jsx` is a large file.

## Updating the site

1. Replace **`src/App.jsx`** with the new website script.
   On github.com: open `src/App.jsx`, click the pencil icon, delete the
   contents, paste the new file, then **Commit changes**. (Or drag the file
   into the `src` folder via **Add file > Upload files**, keeping the name
   `App.jsx`.)
2. That is it. The **Build and publish site** Action builds the app and commits
   the result to `docs/`, and GitHub Pages serves it. Give it a minute or two,
   then hard-refresh the site (Ctrl/Cmd + Shift + R).

Watch a build under the repo **Actions** tab. A red run means the build failed
and the live site was left untouched.

## Layout

| Path | What it is |
| --- | --- |
| `src/App.jsx` | **The website.** This is the only file you normally edit. |
| `src/main.jsx` | Three lines that mount the app. Leave alone. |
| `index.html` | Page shell: title, description, social preview tags. Edit for SEO. |
| `vite.config.js` | Build config. Leave alone. |
| `docs/` | **Generated output - never edit by hand.** Anything changed here is overwritten on the next build. |
| `docs/CNAME` | The custom domain. Do not delete it or the domain stops working. |
| `.github/workflows/deploy.yml` | The build-and-publish Action. |

## Running it locally (optional)

Requires [Node.js](https://nodejs.org) 20+.

```bash
npm install
npm run dev     # preview at http://localhost:5173 with live reload
npm run build   # write the production build into docs/
```

## Earlier versions

Previous `.jsx` versions were removed from the working tree during the move to
this build setup. They remain in the git history - to get one back:

```bash
git show cae295f:jagobx-website-v2.jsx > old-v2.jsx
```

## Accessibility

The site targets WCAG 2.1 Level AA: descriptive alt text, a skip link, landmark
and heading structure, keyboard operation with visible focus, AA colour
contrast, reflow to 320px, and respect for reduced-motion preferences. Worth
re-checking after any visual change.
