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

// Narrow entry for consumers that need only the HTTP calls, not the full
// barrel: the full index also re-exports the Zustand store, whose
// `getProvider` import drags the native keystore/Ledger extension chain into
// any bundle that resolves it — fatal for a non-RN target like the browser
// extension's service worker, which has no bundler alias for those natives.
export {
    requestChallenge,
    attestDevice,
    verifyIntegrityToken,
    type RequestChallengeParams,
    type AttestDeviceParams,
    type VerifyIntegrityTokenParams,
} from './api/integrity'
