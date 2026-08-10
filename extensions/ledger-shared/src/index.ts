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

// Platform-agnostic Ledger protocol surface: types, errors, APDU codes,
// timeout constants, classification helpers. Loaded by the business-logic
// `@perawallet/wallet-core-ledger` package *without* pulling in
// `@ledgerhq/react-native-hw-transport-ble` or other RN-only modules
// (which carry Flow-typed source that vitest can't parse).
export * from './types'
export * from './errors'
export * from './constants'
export * from './transport-wrapper'
