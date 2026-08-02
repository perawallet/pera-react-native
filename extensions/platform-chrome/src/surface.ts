/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

export type ExtensionSurface = 'popup' | 'expanded' | 'approval' | 'offscreen'

const SURFACES: readonly string[] = [
    'popup',
    'expanded',
    'approval',
    'offscreen',
]

/**
 * Reads the surface flag injected by the extension build: each surface HTML
 * loads a `surface-<name>.js` that sets `window.__PERA_SURFACE__` before the
 * app bundle executes (see apps/browser/scripts/build.mjs). Falls back to
 * 'expanded' for non-extension hosts (expo web dev server) and unknown values.
 */
export const getSurface = (): ExtensionSurface => {
    const raw = (globalThis as { __PERA_SURFACE__?: unknown }).__PERA_SURFACE__
    return typeof raw === 'string' && SURFACES.includes(raw)
        ? (raw as ExtensionSurface)
        : 'expanded'
}
