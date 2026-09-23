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

import { setWasmUrl } from '@lottiefiles/dotlottie-react'

// apps/mobile deliberately has no chrome types (extension APIs live in
// extensions/*); this narrow declaration covers the one call below.
declare const chrome: {
    runtime: { getURL: (path: string) => string }
}

// dotlottie's default loader fetches its wasm engine from cdn.jsdelivr.net
// (unpkg fallback) at runtime — remotely hosted code executing in extension
// pages, and grounds for Chrome Web Store rejection. Point it at the copy the
// extension build ships instead. apps/browser/scripts/build.mjs both copies
// the wasm into dist/ and asserts this exact getURL('dotlottie-player.wasm')
// call survives into the minified bundle — keep the literal inline.
setWasmUrl(chrome.runtime.getURL('dotlottie-player.wasm'))
