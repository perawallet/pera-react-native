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

import { isSqlStatementTimeout } from '@perawallet/wallet-extension-platform-chrome'
import type { InitializeDatabaseOptions } from '@perawallet/wallet-core-database'
import { useSyncCursorStore } from '@perawallet/wallet-core-background'
import { logger } from '@perawallet/wallet-core-shared'

type DatabaseRecovery = NonNullable<InitializeDatabaseOptions['recovery']>

// A migration that outlasts the worker's per-statement timeout would roll back
// and fail again on every launch, so the cache is wiped and rebuilt instead.
export const createDatabaseRecovery = (
    onReset: () => Promise<void>,
): DatabaseRecovery => ({
    isRecoverable: isSqlStatementTimeout,
    onReset: async tag => {
        logger.warn('[offscreen] migration timed out, cache rebuilt', { tag })
        // The cursors still describe the wiped rows: transaction sync only asks
        // for rounds past refreshRound, and assets and prices would wait out
        // their TTLs. Without cursors the next tick syncs everything.
        useSyncCursorStore.getState().resetState()
        await onReset()
    },
})
