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

import type { Arc0027Handler } from '../arc0027/dispatcher'

export const createDisableHandler =
    (deps: {
        sessionId: string
        teardown: (sessionId: string) => void
    }): Arc0027Handler =>
    async () => {
        // Defer teardown so the dispatcher's `{ sessionIds }` ack is flushed
        // over the still-open channel first. Closing synchronously here would
        // make the subsequent `client.send(response)` a no-op (the channel is
        // already gone) and the dApp would never receive its disable ack.
        setTimeout(() => deps.teardown(deps.sessionId), 0)
        return { sessionIds: [deps.sessionId] }
    }
