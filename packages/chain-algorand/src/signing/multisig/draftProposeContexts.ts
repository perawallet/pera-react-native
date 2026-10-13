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

import type { DraftProposeContext } from '@perawallet/wallet-core-signing'

const contexts = new Map<string, DraftProposeContext>()

export const draftProposeContexts = {
    set: (draftLocalId: string, context: DraftProposeContext): void => {
        contexts.set(draftLocalId, context)
    },
    get: (draftLocalId: string): DraftProposeContext | undefined =>
        contexts.get(draftLocalId),
    /** Remove and return; called only after the bootstrap propose succeeded. */
    take: (draftLocalId: string): DraftProposeContext | undefined => {
        const context = contexts.get(draftLocalId)
        contexts.delete(draftLocalId)
        return context
    },
    /** Test-only: drop every entry. */
    __resetForTests: (): void => {
        contexts.clear()
    },
}
