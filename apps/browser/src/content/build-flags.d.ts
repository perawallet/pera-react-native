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
 * Baked by `scripts/build.mjs`: whether this build serves an EVM chain. A
 * build that serves none never offers itself to EVM dApps, and esbuild drops
 * the EIP-1193 provider from the bundle.
 */
declare const __PERA_SERVES_EVM__: boolean
