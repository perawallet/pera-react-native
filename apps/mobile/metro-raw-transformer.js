/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

// @ts-check
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs')
const path = require('path')
const svgTransformer = require('react-native-svg-transformer')

// Resolve @expo/metro-config from expo's package directory. pnpm only links
// @expo/metro-config into apps/mobile/node_modules when it's a direct dep;
// it's a transitive dep via expo, so resolving from here would otherwise
// fail on a clean install (e.g. CI).
const expoDir = path.dirname(require.resolve('expo/package.json'))
const defaultTransformer = require(
    require.resolve('@expo/metro-config/babel-transformer', {
        paths: [expoDir],
    }),
)

// react-native-svg-transformer is a transitive dep (via itself), so resolve
// @svgr/core the same way expoDir is resolved above.
const svgrCore = require(
    require.resolve('@svgr/core', {
        paths: [require.resolve('react-native-svg-transformer')],
    }),
)

// Mirrors react-native-svg-transformer's own `defaultSVGRConfig`
// (node_modules/react-native-svg-transformer/index.js) plus one addition:
// SVGO's built-in "prefixIds" plugin. react-native-svg-transformer hardcodes
// its own `svgoConfig`, which — because @svgr/plugin-svgo only falls back to
// its *own* default (preset-default + "prefixIds") when no `svgoConfig` is
// given at all — silently drops "prefixIds" the moment any project needs to
// tweak preset-default's overrides (as this one does, for `native: true`
// inlineStyles/removeViewBox/etc). Every icon then gets its clipPath/mask
// `id`s minified independently per file by preset-default's `cleanupIds`
// sub-plugin, and since most of our icons have exactly one clipPath, nearly
// all of them end up with the literal id "a". That's invisible on native —
// react-native-svg's native renderer resolves `url(#a)` against each SVG's
// own isolated element tree, not a shared namespace — but react-native-svg's
// *web* output is real DOM: every icon instance mounts its defs into the one
// document-wide `id` namespace, so `url(#a)` resolves to whichever icon's
// `id="a"` happens to be first in DOM order, clipping icons to the wrong
// shape (confirmed via inspection: a page with a handful of icons had 7
// unrelated elements all sharing `id="a"`). "prefixIds" is SVGO's own fix
// for exactly this — it salts every id (and rewrites the `url(#...)`
// references to match) using the file path SVGO already receives as `path`.
// Its *default* salt, though, is only the file's basename (see below) — not
// enough on its own, so a custom `prefix` function is supplied. Scoped to
// `platform === 'web'` only: native keeps calling the untouched library
// transform below, byte-for-byte, so this is provably inert there.
//
// SVGO's own default "prefixIds" salt is `getBasename(path)` only (see
// node_modules/svgo/plugins/prefixIds.js) — two icons that share a filename
// in different directories still collide, e.g. `assets/icons/algo.svg` vs
// `assets/icons/assets/algo.svg`, or `assets/images/key.svg` vs
// `assets/icons/key.svg` (both real pairs in this repo, and the first is
// exactly the portfolio-home Buy-Algo/search-magnifier collision this was
// meant to fix). Supply our own `prefix` function so the salt is derived
// from the *whole* path instead of just the basename: unique per source
// file, and still stable across rebuilds/re-renders because it's a pure
// function of the file's on-disk location relative to this directory (not a
// random value or incrementing counter, which would churn ids — and by
// extension DOM/React reconciliation — on every build).
const mobileRoot = path.resolve(__dirname)

// Ids (and, via prefixIds, the id-derived class/href/url() references) must
// be valid CSS identifiers: no leading digit, and no raw `/` or `.` (a
// literal `.` in an id breaks the moment anything targets it as a CSS
// selector, e.g. `#foo.bar`).
const toIdToken = value => {
    const sanitized = value.replace(/[^a-zA-Z0-9_-]/g, '_')
    return /^[a-zA-Z_]/.test(sanitized) ? sanitized : `svg_${sanitized}`
}

const svgIdPrefix = (_node, info) =>
    toIdToken(info.path ? path.relative(mobileRoot, info.path) : 'svg')

const WEB_SVGR_CONFIG = {
    native: true,
    plugins: ['@svgr/plugin-svgo', '@svgr/plugin-jsx'],
    svgoConfig: {
        plugins: [
            {
                name: 'preset-default',
                params: {
                    overrides: {
                        inlineStyles: { onlyMatchedOnce: false },
                        removeViewBox: false,
                        removeUnknownsAndDefaults: false,
                        convertColors: false,
                    },
                },
            },
            { name: 'prefixIds', params: { prefix: svgIdPrefix } },
        ],
    },
}

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// A path-scoped prefix (above) makes ids unique per *source file*, but an
// id still has to be unique per DOM *element* — and the same icon file is
// routinely mounted more than once on one page (e.g. `plus.svg` backs both
// an "Add asset" button and an NFT empty-state button; `magnifying-glass.svg`
// backs every search field). Two mounted instances of the same generated
// component render the exact same literal `id="…"` string, so the static
// per-file prefix alone still produces real DOM id duplicates the moment an
// icon is used twice on a page — confirmed by this file's own e2e guard
// (`wallet-smoke.spec.ts`) failing with duplicate `assets_icons_plus_svg__a`
// / `assets_icons_magnifying-glass_svg__a` ids before this function existed.
// Fix: make the id unique per mounted *instance* by salting it at render
// time with `React.useId()` (React's own primitive for exactly this:
// stable-per-instance, unique-per-mount identifiers) on top of the
// build-time path prefix. Only files whose SVGO output actually contains a
// prefixed id (i.e. only icons with a clipPath/mask/etc.) pay this cost —
// most icons have no `id` at all and are returned untouched.
function makeSvgIdsInstanceUnique(jsx, filePath) {
    const prefix = svgIdPrefix(null, { path: filePath })
    const idPattern = new RegExp(`${escapeRegExp(prefix)}__[A-Za-z0-9_-]+`, 'g')
    if (!idPattern.test(jsx)) {
        return jsx
    }

    // Every id/class/url(#…)/href reference prefixIds touches lives inside a
    // plain double-quoted JSX attribute string (SVGR/Babel's default
    // printer). Turn just the strings that contain one of our ids into a JSX
    // expression container holding a template literal, splicing in the
    // per-instance `uid` right before each id token — this leaves every
    // other attribute (fill, stroke, viewBox, …) as an untouched string.
    const withDynamicIds = jsx.replace(/"([^"]*)"/g, (whole, value) => {
        idPattern.lastIndex = 0
        if (!idPattern.test(value)) {
            return whole
        }
        idPattern.lastIndex = 0
        const withUid = value.replace(idPattern, match => '${uid}' + match)
        return '{`' + withUid + '`}'
    })

    // SVGR emits a single implicit-return arrow function component
    // (`const SvgFoo = props => <Svg ...>...</Svg>;`) for every icon in this
    // codebase (verified across the largest/most complex icons on disk, not
    // just the small ones) — rewrite to a block body so `useId()` has
    // somewhere to run. "id" is prefixed onto useId()'s own value (rather
    // than used raw) purely so this never depends on React's own id format
    // (currently `:r0:`) still being a valid identifier fragment.
    return withDynamicIds.replace(
        /=>\s*(<Svg[\s\S]*?<\/Svg>);/,
        '=> { const uid = "id" + React.useId().replace(/[^a-zA-Z0-9_-]/g, ""); return $1; };',
    )
}

async function transformSvgForWeb(params) {
    const jsx = await svgrCore.transform(params.src, WEB_SVGR_CONFIG, {
        filePath: params.filename,
    })
    const jsxWithInstanceUniqueIds = makeSvgIdsInstanceUnique(
        jsx,
        params.filename,
    )
    return defaultTransformer.transform({
        ...params,
        src: jsxWithInstanceUniqueIds,
    })
}

/**
 * Metro transformer that handles raw file imports (.sql) and SVGs,
 * delegating everything else to the default Expo Babel transformer.
 *
 * For .sql files, reads the file content and wraps it as a JS module
 * exporting the raw string — matching Vite's ?raw import behavior.
 */
module.exports.transform = function (params) {
    if (params.filename.endsWith('.sql')) {
        const content = fs.readFileSync(params.filename, 'utf8')

        return defaultTransformer.transform({
            ...params,
            src: `module.exports = ${JSON.stringify(content)};`,
        })
    }

    if (params.filename.endsWith('.svg')) {
        if (params.options?.platform === 'web') {
            return transformSvgForWeb(params)
        }
        return svgTransformer.transform(params)
    }

    return defaultTransformer.transform(params)
}
