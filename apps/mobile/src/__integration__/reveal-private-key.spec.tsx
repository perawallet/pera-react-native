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

import React from 'react'
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import {
    act,
    fireEvent,
    renderHook,
    screen,
    waitFor,
} from '@testing-library/react'

import { render } from '@test-utils/render'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    accountsChainAdapters,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { parseEthereumPrivateKey } from '@perawallet/wallet-core-chain-ethereum'
import { usePinCode } from '@perawallet/wallet-core-security'
import { useRevealPrivateKeyFlow } from '@modules/view-passphrase'
import { BottomSheetManager } from '@modules/bottom-sheet'
import { useBottomSheetStore } from '@modules/bottom-sheet/store/bottomSheetStore'
import {
    PIN_FLOW_TEST_TIMEOUT_MS,
    SLOW_WAIT_TIMEOUT_MS,
} from './__fixtures__/timeouts'

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: {
            ...actual.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
    }
})

// Hardhat's first development account: a published test key, never funded on mainnet.
const TEST_PRIVATE_KEY =
    'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const TEST_PIN = '123456'

const RevealHost = ({ account }: { account: WalletAccount }) => {
    const { openRevealPrivateKeyFlow } = useRevealPrivateKeyFlow()
    return (
        <>
            <BottomSheetManager />
            <button
                data-testid='open_reveal_private_key'
                onClick={() => {
                    void openRevealPrivateKeyFlow(account.id, 'ethereum')
                }}
            >
                Open
            </button>
        </>
    )
}

const importTestAccount = (): Promise<WalletAccount> =>
    useAccountsStore
        .getState()
        .importAccountFromPrivateKey(
            'ethereum',
            parseEthereumPrivateKey(TEST_PRIVATE_KEY),
        )

const savePin = async (): Promise<void> => {
    const { result: pinHook } = renderHook(() => usePinCode())
    await act(async () => {
        await pinHook.current.savePin(TEST_PIN)
        expect(await pinHook.current.checkPinEnabled()).toBe(true)
    })
}

// The key the adapter hands the flow, so the test can check it was zeroed.
const captureRevealedKeys = (): Uint8Array[] => {
    const revealed: Uint8Array[] = []
    const adapter = accountsChainAdapters.get('ethereum')
    const reveal = adapter.revealPrivateKey!.bind(adapter)
    vi.spyOn(adapter, 'revealPrivateKey').mockImplementation(
        async (...args) => {
            const key = await reveal(...args)
            revealed.push(key)
            return key
        },
    )
    return revealed
}

const VALUE_TEST_ID = 'reveal_private_key_bottom_sheet_value'

describe(
    'Flow: Reveal an imported private key',
    { timeout: PIN_FLOW_TEST_TIMEOUT_MS },
    () => {
        beforeAll(async () => {
            await setupTestDatabase()
        })
        afterAll(async () => {
            await teardownTestDatabase()
        })

        beforeEach(async () => {
            await resetTestDatabase()
            resetTestKeystore()
            useAccountsStore.getState().setAccounts([])
            vi.restoreAllMocks()
        })

        it('Given a PIN, when the user opens the reveal, then the key appears only after the PIN, and is zeroed once the sheet closes', async () => {
            const account = await importTestAccount()
            await savePin()
            const revealed = captureRevealedKeys()
            render(<RevealHost account={account} />)

            fireEvent.click(screen.getByTestId('open_reveal_private_key'))
            await waitFor(() => screen.getByTestId('numpad_key_1'))
            expect(screen.queryByTestId(VALUE_TEST_ID)).toBeNull()
            expect(revealed).toHaveLength(0)

            for (const digit of TEST_PIN) {
                await act(async () => {
                    fireEvent.click(screen.getByTestId(`numpad_key_${digit}`))
                })
            }

            await waitFor(
                () =>
                    expect(screen.getByTestId(VALUE_TEST_ID).textContent).toBe(
                        `0x${TEST_PRIVATE_KEY}`,
                    ),
                { timeout: SLOW_WAIT_TIMEOUT_MS },
            )
            expect(revealed).toHaveLength(1)
            expect(revealed[0]!.some(byte => byte !== 0)).toBe(true)

            act(() => {
                useBottomSheetStore.getState().dismissAll()
            })

            await waitFor(() =>
                expect(screen.queryByTestId(VALUE_TEST_ID)).toBeNull(),
            )
            await waitFor(() =>
                expect(revealed[0]!.every(byte => byte === 0)).toBe(true),
            )
        })

        it('Given a PIN, when the user closes the PIN sheet, then the key is never read or shown', async () => {
            const account = await importTestAccount()
            await savePin()
            const revealed = captureRevealedKeys()
            render(<RevealHost account={account} />)

            fireEvent.click(screen.getByTestId('open_reveal_private_key'))
            await waitFor(() => screen.getByTestId('close-button'))
            fireEvent.click(screen.getByTestId('close-button'))

            await waitFor(() =>
                expect(screen.queryByTestId('numpad_key_1')).toBeNull(),
            )
            expect(screen.queryByTestId(VALUE_TEST_ID)).toBeNull()
            expect(revealed).toHaveLength(0)
        })
    },
)
