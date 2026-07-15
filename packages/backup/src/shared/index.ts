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

// Primitives shared between the ASB (ARC-35) and Pera Web import flows.
// Both flows decrypt the same secretbox layout, both rebuild an algo25
// account from a raw seed, and both decode `private_key` fields whose
// on-wire encoding has a couple of legitimate formats.
export * from './secretbox'
export * from './decode-key-bytes'
export * from './useImportAlgo25FromSeed'
