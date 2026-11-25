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

import type { MigrationLedger } from '@algorandfoundation/provider-migrations'

const heldFrom = new Map<string, number>()

/**
 * Keeps `module`'s ledger cursor below `revision` for the rest of this launch,
 * so the revision runs again next launch. The runner has no skip outcome and
 * ledgers whatever resolves; and the cursor is a high-water mark, so every
 * later revision of the module goes unledgered too and re-runs with it.
 */
export const deferRevisionToNextLaunch = (
    module: string,
    revision: number,
): void => {
    const held = heldFrom.get(module)
    if (held === undefined || revision < held) heldFrom.set(module, revision)
}

export const withDeferredRevisions = (
    ledger: MigrationLedger,
): MigrationLedger => ({
    read: () => ledger.read(),
    write: async (module, revision) => {
        const held = heldFrom.get(module)
        if (held !== undefined && revision.id >= held) return
        await ledger.write(module, revision)
    },
})
