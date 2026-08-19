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
 * Web build, picked by Metro's `.web.ts` resolution. `createKeystore.web.ts`
 * already leaves `subtle` to the IndexedDB driver's own `globalThis` default
 * rather than the injected value, so this is never actually consulted by the
 * web keystore — it exists only so `singleton.ts` can stay platform-neutral
 * and pass something of the right shape through `options.keystore.subtle`.
 */
export const subtle = globalThis.crypto.subtle
