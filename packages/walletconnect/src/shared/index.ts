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

// Genuinely shared between WalletConnect v1 and v2: reading a bare `wc:` URI
// (the deep-link wrappers are unwrapped by the mobile parser before a URI
// reaches this package), PERA_CLIENT_META, the peer reader, the error
// taxonomy and the ARC-60 wire schema. Neither protocol implementation may
// import the other directly — see lanekeep's `pera/no-cross-protocol-imports`.

export * from './constants'
export * from './errors'
export * from './schema'
export * from './chain'
export * from './expectedChainId'
export * from './peer'
export * from './uri'
