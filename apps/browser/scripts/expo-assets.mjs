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

const SCALE_VARIANT = /^(.+)@\d+(?:\.\d+)?x(\.[^./]+)$/

const ASSET_REFERENCE = /["'`]\/(assets\/[^"'`]+)["'`]/g

/**
 * `expo export` copies every @Nx variant of an image, but Expo's web asset
 * transformer points the bundle at the 1x file alone (`{ uri:
 * '/assets/.../name.<hash>.png' }`), so nothing can load the variants. A variant
 * is only dropped when its 1x path is in the bundle and its own path is not: an
 * export that resolves scales at runtime names neither, and keeps them all.
 *
 * @param {string[]} assetPaths dist-relative, `/`-separated
 * @param {string} uiCode every exported UI chunk
 * @returns {string[]}
 */
export const findUnreferencedScaleVariants = (assetPaths, uiCode) =>
    assetPaths.filter(assetPath => {
        const match = SCALE_VARIANT.exec(assetPath)
        if (!match) return false
        const [, stem, extension] = match
        return (
            uiCode.includes(`/${stem}${extension}`) &&
            !uiCode.includes(`/${assetPath}`)
        )
    })

/**
 * The `/assets/...` paths the UI bundle loads that dist does not contain.
 *
 * @param {string} uiCode every exported UI chunk
 * @param {string[]} distPaths dist-relative, `/`-separated
 * @returns {string[]}
 */
export const findMissingAssetReferences = (uiCode, distPaths) => {
    const present = new Set(distPaths)
    const referenced = new Set(
        [...uiCode.matchAll(ASSET_REFERENCE)].map(([, assetPath]) => assetPath),
    )
    return [...referenced].filter(assetPath => !present.has(assetPath)).sort()
}

const PNPM_STORE_ASSET =
    /^assets\/__node_modules\/\.pnpm\/[^/]+\/node_modules\/(.+)$/

/**
 * Where a package's image ships instead of its pnpm store path, or `null` for
 * an app asset. The store directory alone runs past 100 characters, and Chrome
 * on Windows installs under a profile path long enough to push the full path
 * over MAX_PATH.
 *
 * @param {string} assetPath dist-relative, `/`-separated
 * @returns {string | null}
 */
export const vendorAssetPath = assetPath => {
    const match = PNPM_STORE_ASSET.exec(assetPath)
    return match ? `assets/vendor/${match[1]}` : null
}
