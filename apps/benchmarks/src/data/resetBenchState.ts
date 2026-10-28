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

import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { seedNativeAssets } from '@perawallet/wallet-core-assets'
import { useSyncCursorStore } from '@perawallet/wallet-core-background'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import { clearDatabase, getDatabase } from '@perawallet/wallet-core-database'
import type { FixtureNetwork } from '../network/fixtureNetwork'

/**
 * Back to an installed-and-empty app between scenarios: every table emptied
 * (not the file deleted, which would free a handle sync may still hold), the
 * native assets seeded again as bootstrap does, and the stores and fixture
 * handlers cleared. Keystore keys are left alone; scenarios that mint some
 * discard them in their own teardown.
 */
export const resetBenchState = async (
    network: FixtureNetwork,
): Promise<void> => {
    network.reset()
    await clearDatabase(getDatabase(), { keep: [] })
    await seedNativeAssets(getDatabase())
    useAccountsStore.getState().resetState()
    useSyncCursorStore.getState().resetState()
    // Fixtures answer as the live wallet mode, as the integration tests set it.
    useNetworkStore.getState().setMode('live')
}
