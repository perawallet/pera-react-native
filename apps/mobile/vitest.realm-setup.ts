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

// jsdom installs its own `Uint8Array`, but node's `Buffer` extends node's — a
// different constructor — so `buffer instanceof globalThis.Uint8Array` is false
// and any `isBytes()` check (e.g. in xhd-wallet-api's derivation) throws.
// Aliasing the global realigns them. Production never hits this: on
// react-native the two already share a realm.
//
// Its own setup file, listed first, because base64-js captures `Uint8Array` on
// load: aliasing after `vitest.setup.ts` has imported it leaves decoded bytes
// that algosdk's `instanceof` key checks reject.
;(globalThis as { Uint8Array: typeof Uint8Array }).Uint8Array =
    Object.getPrototypeOf(Buffer.prototype).constructor as typeof Uint8Array
