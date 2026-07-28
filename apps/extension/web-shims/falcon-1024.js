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

// Web shim for falcon-1024. The real package's Emscripten-generated
// dist/index.js fails to even parse under Metro's web bundler ("Unexpected
// token: name (falcon_wasm_default)"), so it can never ship in the extension
// bundle. It's only reachable via wasmFalconProvider.ts, which getPQProvider
// selects off-device (node/test) — quantum accounts are additionally
// capability-gated off on web (routeCapabilities.quantum, capabilities.web.ts)
// since there is no working signer path here yet, so this shim only needs to
// throw loud if that gate is ever bypassed, not actually sign anything.
const unavailable = () => {
    throw new Error(
        'falcon-1024 is unavailable on web — quantum accounts are gated off (routeCapabilities.quantum); see metro.config.js webStubs',
    )
}

export const generateKey = unavailable
export const signCompressed = unavailable

// A real Falcon-1024 public key is 1793 bytes. Exporting 0 here would let a
// caller that slipped past the `quantum: false` web capability gate build a
// zero-length key silently; throwing matches the other exports in this shim.
Object.defineProperty(exports, 'FALCON_DET1024_PUBKEY_SIZE', {
    get: unavailable,
    enumerable: true,
})
