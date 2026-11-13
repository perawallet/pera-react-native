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

// A production build holds no integrity token until the launch's attestation
// lands, and every Ethereum history read needs one. History opened in that
// window waits for it and lists the rows, never showing the error state.
// Copy is asserted by key: this project renders i18n keys.

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { act, renderHook, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { server } from '@test-utils/msw-server'
import { SLOW_WAIT_TIMEOUT_MS } from './__fixtures__/timeouts'

vi.mock('@modules/signing/hooks/useTransactionHeroTitle', () => ({
    useTransactionHeroTitle:
        () =>
        ({ key }: { key: string }) =>
            key,
}))

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const withBackend = await (
        await import('@packages/chain-ethereum/src/__tests__/pera-backend')
    ).withEthereumPeraBackend(importOriginal)
    return {
        ...withBackend,
        config: {
            ...withBackend.config,
            appEnvironment: 'production',
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
    }
})

// The integration setup loads the Pera query client before this file's config
// mock exists, and the client reads its deployments once, so everything under
// test is loaded afresh.
vi.resetModules()
vi.doMock(
    '@react-navigation/native',
    () => import('@test-utils/test-navigator'),
)
vi.doMock('@react-navigation/native-stack', async () => ({
    createNativeStackNavigator: (await import('@test-utils/test-navigator'))
        .createNativeStackNavigator,
}))
const { setTestTheme } = await import('@test-utils/test-theme')
const { getTheme } = await import('@theme/theme')
setTestTheme(getTheme('light'))
const { useAccountsStore } = await import('@perawallet/wallet-core-accounts')
const { evmHistoryItem } =
    await import('@perawallet/wallet-core-chain-ethereum/test-handlers')
const { useAppIntegrityRegistration, useAppIntegrityStore } =
    await import('@perawallet/wallet-core-app-integrity')
const { getProvider } = await import('@perawallet/wallet-extension-provider')
const { peraEvmHistoryHandlers } =
    await import('@packages/chain-ethereum/src/history/api/msw-handlers')
const { renderWithNavigation } =
    await import('@test-utils/renderWithNavigation')
const { resetTestDatabase, setupTestDatabase, teardownTestDatabase } =
    await import('@test-utils/database-setup')
const { AccountHistory } =
    await import('@modules/accounts/components/AccountHistory/AccountHistory')

const ETH_ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
const COUNTERPARTY = '0x1111111111111111111111111111111111111111'
const HASH = `0x${'1'.padStart(64, '0')}`

const ETH_ACCOUNT: WalletAccount = {
    id: 'eth-watch',
    custody: { kind: 'watch' },
    chains: { ethereum: { address: ETH_ADDRESS } },
    name: 'Ethereum watch',
}

describe('Flow: History opened while the launch attestation is running', () => {
    let releaseAttestation: () => void = () => {}
    let historyReads = 0
    let historyTokens: (string | null)[] = []

    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        useAppIntegrityStore.getState().resetState()
        useAccountsStore.getState().setAccounts([ETH_ACCOUNT])
        useAccountsStore.getState().setSelectedAccountId(ETH_ACCOUNT.id)

        // A production iOS device whose native attestation is still pending.
        const provider = getProvider()
        Object.assign(provider.deviceInfo, {
            getAppEnvironment: () => 'production',
            getDeviceInstallationID: async () => 'device-1',
        })
        const attestation = new Promise<void>(resolve => {
            releaseAttestation = resolve
        })
        Object.assign(provider, {
            appIntegrity: {
                isSupported: async () => true,
                attest: async () => {
                    await attestation
                    return { attestation: 'apple-attestation', keyId: 'key-1' }
                },
            },
        })

        historyReads = 0
        historyTokens = []
        server.events.on('request:start', ({ request }) => {
            if (!request.url.includes('/transactions/')) return
            historyReads++
            historyTokens.push(request.headers.get('x-app-integrity-token'))
        })
        server.use(
            http.post('*/api/v3/public/integrity/challenge', () =>
                HttpResponse.json({ challenge: 'challenge-1' }),
            ),
            http.post('*/api/v3/public/integrity/attest', () =>
                HttpResponse.json({
                    integrity_token: 'minted-token',
                    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
                }),
            ),
            ...peraEvmHistoryHandlers({
                history: {
                    [ETH_ADDRESS]: [
                        [
                            evmHistoryItem({
                                hash: HASH,
                                block_time: '2026-01-01T00:00:00Z',
                                from: COUNTERPARTY,
                                to: ETH_ADDRESS,
                                value: '1000000000000000000',
                            }),
                        ],
                    ],
                },
            }),
        )
    })

    afterEach(() => {
        server.events.removeAllListeners()
        useAccountsStore.getState().setAccounts([])
        useAppIntegrityStore.getState().resetState()
    })

    it('Given a launch still attesting, when History opens, then it waits for the token and lists the history without the error', async () => {
        const { result } = renderHook(() => useAppIntegrityRegistration())
        act(() => {
            void result.current.register()
        })

        renderWithNavigation(AccountHistory, 'AccountHistory')

        // Held, not refused: no read has gone out and no error is showing.
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 300))
        })
        expect(historyReads).toBe(0)
        expect(screen.queryByText('common.error.title')).toBeNull()

        releaseAttestation()

        await waitFor(
            () =>
                expect(
                    screen.queryAllByTestId(/^transaction_row_0x/),
                ).toHaveLength(1),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(screen.queryByText('common.error.title')).toBeNull()
        // Independent of how long the wait took: no read ever went out token-less.
        expect(historyTokens).not.toHaveLength(0)
        expect(historyTokens.every(token => token === 'minted-token')).toBe(
            true,
        )
    })
})
