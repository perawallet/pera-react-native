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

/** EIP-5792's error codes; each reaches the dApp verbatim. */
export const EIP5792_ERROR_CODE = {
    unsupportedCapability: 5700,
    unsupportedChainId: 5710,
    duplicateId: 5720,
    unknownBundleId: 5730,
    atomicityNotSupported: 5760,
} as const
