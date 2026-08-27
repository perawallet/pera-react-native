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

import type { SourceMetadata } from './types'
import type { MsigMetadata } from './transports/createMultisigProposeTransport'

/**
 * Delivery context a deferred (draft) propose carries to its bootstrap.
 *
 * A hardware-only proposer defers the backend propose to a local draft, but
 * the sync-flow delivery wiring (handoff registration, `onProposed`) can only
 * attach to a real backend record. Without this stash the bootstrapped record
 * is created with `type: 'sync'` and no registered deliverer, so the backend
 * holds it at `ready` forever and every participant's sheet hangs on
 * "Submitting transaction" (PERA-4987). In-memory on purpose, matching the
 * draft store's lifetime: if the app dies before bootstrap, the draft itself
 * is gone and there is nothing left to deliver.
 */
export type DraftProposeContext = {
    source: SourceMetadata
    /** Validated at draft time; present only for external callback sources. */
    msigMetadata?: MsigMetadata
    /** Validated at draft time; present only for external callback sources. */
    deviceId?: string
}

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
