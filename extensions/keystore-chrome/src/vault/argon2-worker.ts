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

import { computeArgon2id, type Argon2Request } from './argon2'

// One derivation per worker: the page terminates it after the reply, which
// also frees the 64 MiB Argon2 working memory.
self.onmessage = (event: MessageEvent<Argon2Request>) => {
    // Same guard as db-worker.ts: a dedicated worker's messages carry an empty
    // origin, so only a non-empty foreign one is refused.
    if (event.origin && event.origin !== location.origin) return
    const key = computeArgon2id(event.data)
    self.postMessage(key, { transfer: [key.buffer] })
}
