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

/**
 * Narrow entry point for the pure P-256/credential-id helpers, on its own
 * entry for the same reason `./native` and `./webauthn` exist: the package
 * root (and `./crypto/derivePasskeyCredential`, via `derivePasskeyMainKey`)
 * pulls in `react-native-quick-crypto`, which has no loadable build outside a
 * React Native runtime. `packages/migrate` needs only these two pure
 * functions, not that native module.
 */
export * from './crypto/p256Spki'
