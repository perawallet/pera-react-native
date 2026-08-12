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
 * The Android credential provider's on-disk contract, on its own entry point
 * for the same reason `./webauthn` exists: `packages/migrate` needs the codec
 * and nothing else, and the package root pulls `./bootstrap` ->
 * `@algorandfoundation/react-native-keystore` -> `react-native-mmkv`, which
 * constructs an MMKV instance at module scope and so cannot be imported off
 * device. This entry is pure WebCrypto and has no dependencies at all.
 */
export * from './native/nativeProviderRecord'
