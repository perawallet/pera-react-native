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

// Umbrella package for all wallet backup concerns. Subdomains:
//   - mnemonic: "has the user written down their phrase?" prompt state
//   - asb:      Algorand Secure Backup (ARC-35) recovery-only support
//   - peraweb:  Pera Web "Transfer Accounts" QR-based import
//   - cloud:    end-to-end encrypted multi-device cloud backup + sync
//   - shared:   primitives common to ASB + Pera Web (secretbox, seed→
//               mnemonic import, private_key decoder)
export * from './asb'
export * from './cloud'
export * from './mnemonic'
export * from './peraweb'
export * from './shared'
