/*
 Copyright 2022-2025 Pera Wallet, LDA
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
 * Pera-specific keystore type for flat Algo25 (Ed25519) wallet keys. The
 * platform keystore's KeyType union accepts arbitrary strings, so we use a
 * dedicated value rather than overloading `'hd-derived-ed25519'` (which
 * implies HD-derived semantics) or `'ecc'` (which the default importEd25519Key
 * handler silently rewrites to).
 */
export const ALGO25_KEYSTORE_TYPE = 'algo25' as const
