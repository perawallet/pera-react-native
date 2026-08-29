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
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import {
    fireEvent,
    renderHook,
    screen,
    waitFor,
    within,
} from '@testing-library/react'

import { render } from '@test-utils/render'
import { server } from '@test-utils/msw-server'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useKMS, type QuantumKeyResult } from '@perawallet/wallet-core-kms'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { useViewPassphraseFlow } from '@modules/view-passphrase'
import { BottomSheetManager } from '@modules/bottom-sheet'

import {
    QUANTUM_TEST_ADDRESS,
    QUANTUM_TEST_MNEMONIC,
} from './__fixtures__/quantum'

const SLOW_TEST_TIMEOUT_MS = 30_000

// Tiny host that drives the imperative `useViewPassphraseFlow` hook when the
// trigger is tapped — mirrors the harness in `view-passphrase.test.tsx`
// (models how `AccountOptionsContent` opens the flow in production).
const ViewPassphraseHost = ({
    address,
    onClose = () => undefined,
}: {
    address: string
    onClose?: () => void
}) => {
    const { openViewPassphraseFlow } = useViewPassphraseFlow()
    return (
        <>
            {/* The flow opens its PIN / acknowledge / display steps via
                `useBottomSheet().request(...)` — the test harness uses
                `render()` directly (not `renderWithNavigation`), so we
                need to mount the manager here ourselves. */}
            <BottomSheetManager />
            <button
                data-testid='open_view_passphrase'
                onClick={() => {
                    void openViewPassphraseFlow(address).finally(onClose)
                }}
            >
                Open
            </button>
        </>
    )
}

// Mint a real quantum (Falcon) key from the pinned `QUANTUM_TEST_MNEMONIC` —
// same 25-word format as algo25 — so the keystore can later resolve the
// entropy back to the original phrase. `useMnemonicForAddress` already
// supports `AccountTypes.quantum`: `executeWithMnemonic` walks from the
// child signing key (`keyPairId`) up to its parent seed via
// `resolveSeedKey`, then derives the algo25-format mnemonic from that seed's
// private-key bytes, exactly as it does for algo25. Returns the
// WalletAccount registered in the store.
const seedQuantumAccount = async (): Promise<WalletAccount> => {
    const { result: kms } = renderHook(() => useKMS())
    let key: QuantumKeyResult | null = null
    await waitFor(async () => {
        key = await kms.current.createQuantumKey({
            mnemonic: QUANTUM_TEST_MNEMONIC,
        })
        expect(key).not.toBeNull()
    })
    expect(key!.address).toBe(QUANTUM_TEST_ADDRESS)
    const account: WalletAccount = {
        id: 'quantum-1',
        type: AccountTypes.quantum,
        address: key!.address,
        keyPairId: key!.signKeyId,
        name: 'Quantum Test',
    }
    useAccountsStore.getState().setAccounts([account])
    useAccountsStore.getState().setSelectedAccountAddress(account.address)
    return account
}

// Walk the open ViewPassphrase grid and pull every word leaf in render
// order. The grid lays words out in two columns top-to-bottom; this regex
// matches every plain alpha-only word cell while skipping the numeric index
// cells (which render digits, not letters).
const readMnemonicWordsFromGrid = (): string[] => {
    const grid = screen.getByTestId('view_passphrase_bottom_sheet_grid')
    return within(grid)
        .getAllByText(/^[a-z]+$/)
        .map(node => node.textContent ?? '')
}

// Drive the flow from a closed state through to the words display: open the
// trigger, tick all four acknowledge boxes, and tap reveal. Returns once the
// words grid has rendered.
const advanceToDisplayedWords = async (): Promise<void> => {
    fireEvent.click(screen.getByTestId('open_view_passphrase'))
    await waitFor(() => {
        expect(
            screen.getByTestId('passphrase_acknowledge_bottom_sheet_reveal'),
        ).toBeTruthy()
    })
    for (let i = 0; i < 4; i++) {
        fireEvent.click(
            screen.getByTestId(`passphrase_acknowledge_bottom_sheet_row_${i}`),
        )
    }
    const revealButton = screen.getByTestId(
        'passphrase_acknowledge_bottom_sheet_reveal',
    ) as HTMLButtonElement
    await waitFor(() => {
        expect(revealButton.disabled).toBe(false)
    })
    fireEvent.click(revealButton)
    await waitFor(
        () => {
            expect(
                screen.getByTestId('view_passphrase_bottom_sheet_grid'),
            ).toBeTruthy()
        },
        { timeout: 5000 },
    )
}

describe('backup quantum account', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'warn' })
        await setupTestDatabase()
    })
    afterEach(() => {
        server.resetHandlers()
        useRemoteConfigStore.getState().resetState()
    })
    afterAll(async () => {
        server.close()
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        // resetTestKeystore wipes both account keys AND the typed-secret
        // entries (PIN, biometric blob), so the security gate resets
        // between tests too.
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        vi.clearAllMocks()
    })

    it(
        'Given a quantum account, when the user opens the flow, acknowledges all warnings, and reveals the passphrase, then the original 25-word mnemonic is displayed',
        async () => {
            const account = await seedQuantumAccount()

            render(<ViewPassphraseHost address={account.address} />)

            expect(
                screen.queryByTestId(
                    'passphrase_acknowledge_bottom_sheet_reveal',
                ),
            ).toBeNull()
            expect(
                screen.queryByTestId('view_passphrase_bottom_sheet_grid'),
            ).toBeNull()

            await advanceToDisplayedWords()

            // Every word from the original quantum mnemonic (same 25-word
            // algo25-format phrase, different Falcon-derived address) is
            // rendered inside the grid, in order.
            expect(readMnemonicWordsFromGrid()).toEqual(
                QUANTUM_TEST_MNEMONIC.split(' '),
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
