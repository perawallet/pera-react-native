/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-legacy-network-bridge.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/packages/*/src/legacy-bridge.*.ts'

// Delete an entry when its file is clean; never add one. Flip the rule to
// `error` when the list is empty.
const LEGACY_BRIDGE_BASELINE: readonly string[] = [
    'packages/assets/src/db/seed.ts',
    'packages/assets/src/models/assets.ts',
    'packages/background/src/service/sync-service.ts',
    'packages/backup/src/cloud/hooks/useRegisterCloudBackupMutation.ts',
    'packages/backup/src/cloud/hooks/useRemoveCloudBackupMutation.ts',
    'packages/backup/src/cloud/hooks/useRestoreCloudBackupMutation.ts',
    'packages/chain-shared/src/hooks/useOnNetworkSwitch.ts',
    'packages/chain-shared/src/store/network-store.ts',
    'packages/chain-shared/src/utils/clearCustomNetworkCache.ts',
    'packages/config/src/network-config.ts',
    'packages/contacts/src/schema/index.ts',
    'packages/dapp/src/handler.ts',
    'packages/device/src/hooks/useDevice.ts',
    'packages/device/src/hooks/useDeviceRegistration.ts',
    'packages/device/src/hooks/useIsDeviceRegistrationPending.ts',
    'packages/device/src/hooks/useSwitchNetwork.ts',
    'packages/device/src/store/store.ts',
    'packages/shared/src/api/query-client.ts',
    'packages/shared/src/errors/pera-service.ts',
    'packages/walletconnect/src/shared/chainSupport.ts',
    'packages/walletconnect/src/v1/proposals.ts',
    'packages/walletconnect/src/v1/requests.ts',
]

describe('pera/no-legacy-network-bridge', () => {
    it('reports each converter call and every reference to LEGACY_CHAIN_ID', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            locations(
                found.filter(v => v.file.endsWith('legacy-bridge.bad.ts')),
            ),
        ).toEqual([
            'legacy-bridge.bad.ts:5',
            'legacy-bridge.bad.ts:11',
            'legacy-bridge.bad.ts:12',
            'legacy-bridge.bad.ts:13',
            'legacy-bridge.bad.ts:14',
        ])
    })

    it('ignores member calls, look-alike names, strings, comments and chain-algorand', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            found.filter(
                v =>
                    v.file.endsWith('legacy-bridge.good.ts') ||
                    v.file.endsWith('legacy-bridge.exempt.ts'),
            ),
        ).toEqual([])
    })

    it('reports exactly the baseline files across the real packages', async () => {
        const found = await runRule(RULE, 'packages/*/src/**/*.{ts,tsx}')

        expect([...new Set(found.map(v => v.file))].sort()).toEqual(
            LEGACY_BRIDGE_BASELINE,
        )
    })
})
