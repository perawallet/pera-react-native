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
    act,
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
    DerivationTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    useKMS,
    type Algo25KeyResult,
    type HDWalletKeyResult,
} from '@perawallet/wallet-core-kms'
import { usePinCode } from '@perawallet/wallet-core-security'
import { useViewPassphraseFlow } from '@modules/view-passphrase'
import { BottomSheetManager } from '@modules/bottom-sheet'

import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC,
    ALGO25_TEST_MNEMONIC_INDICES,
    ALGO25_TEST_MNEMONIC_WORDS,
    HD_TEST_ADDRESS,
    HD_TEST_MNEMONIC_24,
    HD_TEST_MNEMONIC_24_INDICES,
    HD_TEST_MNEMONIC_24_WORDS,
    deriveTestHDAddress,
} from './__fixtures__/onboarding'

const SLOW_TEST_TIMEOUT_MS = 30_000

// Tiny host that drives the imperative `useViewPassphraseFlow` hook
// when the trigger is tapped. Models how `AccountOptionsContent` opens
// the flow in production: it calls `openViewPassphraseFlow(address)`
// after dismissing the parent options sheet.
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

// Mint a real algo25 key from the pinned `ALGO25_TEST_MNEMONIC` so the
// keystore can later resolve the entropy back to the original 25-word
// phrase. Returns the WalletAccount registered in the store.
const seedAlgo25Account = async (): Promise<WalletAccount> => {
    const { result: kms } = renderHook(() => useKMS())
    let key: Algo25KeyResult | null = null
    await waitFor(async () => {
        key = await kms.current.createAlgo25Key({
            mnemonicIndices: ALGO25_TEST_MNEMONIC_INDICES,
        })
        expect(key).not.toBeNull()
    })
    const account: WalletAccount = {
        id: 'algo25-1',
        type: AccountTypes.algo25,
        address: ALGO25_TEST_ADDRESS,
        keyPairId: key!.seedKey.id ?? '',
        name: 'Algo25 Test',
    }
    useAccountsStore.getState().setAccounts([account])
    useAccountsStore.getState().setSelectedAccountAddress(account.address)
    return account
}

type SeededHDAccounts = {
    rootAccount: WalletAccount
    derivedAccount: WalletAccount
    rootKeyId: string
}

// Mint an HD root key from `HD_TEST_MNEMONIC_24` and register two HD
// wallet accounts that share the same root: one at the master path
// (account=0, keyIndex=0 → HD_TEST_ADDRESS) and one at the next index
// (account=0, keyIndex=1). Both store the same `keyPairId` so
// `useMnemonicForAddress` resolves the same entropy entry — and
// therefore the same 24-word phrase — for both. This is the property
// the test asserts: derived addresses do not get their own mnemonic.
const seedHDWalletAccounts = async (): Promise<SeededHDAccounts> => {
    const { result: kms } = renderHook(() => useKMS())
    let rootKey: HDWalletKeyResult | null = null
    await waitFor(async () => {
        rootKey = await kms.current.createHDWalletKey({
            mnemonicIndices: HD_TEST_MNEMONIC_24_INDICES,
        })
        expect(rootKey).not.toBeNull()
    })

    const rootKeyId = rootKey!.seedKey.id ?? ''
    const derivedAddress = await deriveTestHDAddress(0, 1)

    const rootAccount: WalletAccount = {
        id: 'hd-root',
        type: AccountTypes.hdWallet,
        address: HD_TEST_ADDRESS,
        keyPairId: rootKeyId,
        name: 'HD Root',
        hdWalletDetails: {
            account: 0,
            change: 0,
            keyIndex: 0,
            derivationType: DerivationTypes.Peikert,
        },
    }
    const derivedAccount: WalletAccount = {
        id: 'hd-derived-1',
        type: AccountTypes.hdWallet,
        address: derivedAddress,
        keyPairId: rootKeyId,
        name: 'HD Derived #1',
        hdWalletDetails: {
            account: 0,
            change: 0,
            keyIndex: 1,
            derivationType: DerivationTypes.Peikert,
        },
    }

    useAccountsStore.getState().setAccounts([rootAccount, derivedAccount])
    useAccountsStore.getState().setSelectedAccountAddress(rootAccount.address)
    return { rootAccount, derivedAccount, rootKeyId }
}

// Walk the open ViewPassphrase grid and pull every word leaf in render
// order. The grid lays words out in two columns top-to-bottom; this
// regex matches every plain alpha-only word cell while skipping the
// numeric index cells (which render digits, not letters).
const readMnemonicWordsFromGrid = (): string[] => {
    const grid = screen.getByTestId('view_passphrase_bottom_sheet_grid')
    return within(grid)
        .getAllByText(/^[a-z]+$/)
        .map(node => node.textContent ?? '')
}

// Drive the flow from a closed state through to the words display:
// open the trigger, tick all four acknowledge boxes, and tap reveal.
// Returns once the words grid has rendered. Use this from any test
// whose subject is the resolved mnemonic, not the gate behavior.
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

describe('Flow: View account passphrase', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'warn' })
        await setupTestDatabase()
    })
    afterEach(() => server.resetHandlers())
    afterAll(async () => {
        server.close()
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        // resetTestKeystore wipes both account keys AND the typed-
        // secret entries (PIN, biometric blob), so the security gate
        // resets between tests too.
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        vi.clearAllMocks()
    })

    it(
        'Given an algo25 account, when the user opens the flow, acknowledges all warnings, and reveals the passphrase, then the original mnemonic is displayed',
        async () => {
            const account = await seedAlgo25Account()
            const onClose = vi.fn()

            render(
                <ViewPassphraseHost
                    address={account.address}
                    onClose={onClose}
                />,
            )

            // Flow is initially closed: neither sheet is mounted.
            // The PWBottomSheet host mock uses a fixed
            // `data-testid="PWBottomSheet"`, so probe by the inner
            // testIDs that the acknowledge / display sheets attach to
            // their own contents.
            expect(
                screen.queryByTestId(
                    'passphrase_acknowledge_bottom_sheet_reveal',
                ),
            ).toBeNull()
            expect(
                screen.queryByTestId('view_passphrase_bottom_sheet_grid'),
            ).toBeNull()

            // Open the flow. With no PIN configured in the test
            // keystore, `checkPinEnabled()` resolves to false, so the
            // first step is the acknowledge sheet (the PIN gate is
            // skipped). The acknowledge sheet always mounts at this
            // point; the reveal CTA stays disabled until every checkbox
            // has been ticked.
            fireEvent.click(screen.getByTestId('open_view_passphrase'))
            await waitFor(() => {
                expect(
                    screen.getByTestId(
                        'passphrase_acknowledge_bottom_sheet_reveal',
                    ),
                ).toBeTruthy()
            })

            const revealButton = screen.getByTestId(
                'passphrase_acknowledge_bottom_sheet_reveal',
            ) as HTMLButtonElement
            expect(revealButton.disabled).toBe(true)

            // Tap each row in turn. Each tap toggles one checkbox; once
            // all four are checked, the reveal CTA enables.
            for (let i = 0; i < 4; i++) {
                fireEvent.click(
                    screen.getByTestId(
                        `passphrase_acknowledge_bottom_sheet_row_${i}`,
                    ),
                )
            }
            await waitFor(() => {
                expect(revealButton.disabled).toBe(false)
            })

            // Reveal advances the flow to the display step. The
            // acknowledge sheet unmounts (PWBottomSheet only renders
            // when `isVisible`), and the display sheet mounts and
            // resolves the mnemonic via the KMS session.
            fireEvent.click(revealButton)

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('view_passphrase_bottom_sheet_grid'),
                    ).toBeTruthy()
                },
                { timeout: 5000 },
            )
            // Acknowledge sheet has unmounted: its reveal button is
            // gone from the DOM.
            expect(
                screen.queryByTestId(
                    'passphrase_acknowledge_bottom_sheet_reveal',
                ),
            ).toBeNull()

            // Every word from the original mnemonic is rendered inside
            // the grid. Order matters — the display lays the 25 words
            // out in two columns top-to-bottom, so we walk the rendered
            // grid in the same order and compare against the source
            // phrase.
            expect(readMnemonicWordsFromGrid()).toEqual(
                ALGO25_TEST_MNEMONIC_WORDS,
            )

            // onClose was not called — the user is still inside the
            // display sheet. Closing the host would fire it, but that's
            // the parent's concern, not the flow's.
            expect(onClose).not.toHaveBeenCalled()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the user opens the flow but cancels at the acknowledge step, when they tap cancel, then onClose fires and no mnemonic is read',
        async () => {
            const account = await seedAlgo25Account()
            const onClose = vi.fn()

            render(
                <ViewPassphraseHost
                    address={account.address}
                    onClose={onClose}
                />,
            )

            fireEvent.click(screen.getByTestId('open_view_passphrase'))
            await waitFor(() => {
                expect(
                    screen.getByTestId(
                        'passphrase_acknowledge_bottom_sheet_cancel',
                    ),
                ).toBeTruthy()
            })

            // Cancel from the acknowledge sheet without ticking any
            // boxes. The flow surfaces this as `onClose`, the host
            // hides the sheet, and the display sheet never mounts.
            fireEvent.click(
                screen.getByTestId(
                    'passphrase_acknowledge_bottom_sheet_cancel',
                ),
            )

            await waitFor(() => {
                expect(onClose).toHaveBeenCalled()
            })
            expect(
                screen.queryByTestId('view_passphrase_bottom_sheet_grid'),
            ).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given an HD wallet root account, when the user reveals the passphrase, then the 24-word HD mnemonic is displayed',
        async () => {
            const { rootAccount } = await seedHDWalletAccounts()

            render(<ViewPassphraseHost address={rootAccount.address} />)
            await advanceToDisplayedWords()

            expect(readMnemonicWordsFromGrid()).toEqual(
                HD_TEST_MNEMONIC_24_WORDS,
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given an HD wallet derived account at keyIndex=1, when the user reveals the passphrase, then the SAME 24-word root mnemonic is displayed (derived addresses share the root phrase)',
        async () => {
            const { rootAccount, derivedAccount } = await seedHDWalletAccounts()
            // Sanity: addresses differ — the derived account is a
            // distinct Algorand address — but they share the keyPairId
            // pointing at the same root key in the keystore.
            expect(derivedAccount.address).not.toBe(rootAccount.address)
            expect(derivedAccount.keyPairId).toBe(rootAccount.keyPairId)

            render(<ViewPassphraseHost address={derivedAccount.address} />)
            await advanceToDisplayedWords()

            // Same expected vector as the root test: an HD wallet has
            // exactly one mnemonic regardless of which derived address
            // the user opens the flow against.
            expect(readMnemonicWordsFromGrid()).toEqual(
                HD_TEST_MNEMONIC_24_WORDS,
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a PIN is configured, when the user opens the flow, then the PIN gate mounts in front of the acknowledge step',
        async () => {
            const account = await seedAlgo25Account()

            // Set the PIN before opening the flow. `savePin` writes to
            // the typed-secret store; `checkPinEnabled` then reports
            // true and the flow's gate routes to step='pin' rather than
            // 'acknowledge'.
            const TEST_PIN = '123456'
            const { result: pinHook } = renderHook(() => usePinCode())
            await waitFor(async () => {
                await pinHook.current.savePin(TEST_PIN)
                expect(await pinHook.current.checkPinEnabled()).toBe(true)
            })

            render(<ViewPassphraseHost address={account.address} />)

            // Open. The PinEditView mounts its numpad — that's the
            // user-facing handle to the gate. The acknowledge sheet
            // and the display sheet are both absent: the gate stands
            // in front of them.
            fireEvent.click(screen.getByTestId('open_view_passphrase'))
            await waitFor(() => {
                expect(screen.getByTestId('PWNumpad')).toBeTruthy()
            })
            expect(
                screen.queryByTestId(
                    'passphrase_acknowledge_bottom_sheet_reveal',
                ),
            ).toBeNull()
            expect(
                screen.queryByTestId('view_passphrase_bottom_sheet_grid'),
            ).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a PIN is configured, when the user enters a PIN one digit short, then the flow stays on the gate (no auto-advance from a partial PIN)',
        async () => {
            const account = await seedAlgo25Account()

            const TEST_PIN = '123456'
            const { result: pinHook } = renderHook(() => usePinCode())
            await waitFor(async () => {
                await pinHook.current.savePin(TEST_PIN)
                expect(await pinHook.current.checkPinEnabled()).toBe(true)
            })

            render(<ViewPassphraseHost address={account.address} />)

            fireEvent.click(screen.getByTestId('open_view_passphrase'))
            await waitFor(() => {
                expect(screen.getByTestId('PWNumpad')).toBeTruthy()
            })

            // Enter five of the six digits — one short of `PIN_LENGTH`.
            // `usePinEntry` only schedules `onPinComplete` once the
            // pin actually reaches length 6, so this is a meaningful
            // negative case: the gate must stay up.
            for (const digit of '12345') {
                await act(async () => {
                    fireEvent.click(
                        within(screen.getByTestId('PWNumpad')).getByText(digit),
                    )
                })
            }

            // Settle: give any pending React commits and the 100ms
            // `onPinComplete` setTimeout (which would NOT have been
            // scheduled, but we wait long enough that any false
            // positive would have surfaced).
            await act(async () => {
                await new Promise(resolve => setTimeout(resolve, 250))
            })

            expect(screen.getByTestId('PWNumpad')).toBeTruthy()
            expect(
                screen.queryByTestId(
                    'passphrase_acknowledge_bottom_sheet_reveal',
                ),
            ).toBeNull()
            expect(
                screen.queryByTestId('view_passphrase_bottom_sheet_grid'),
            ).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given no PIN is configured, when the user opens the flow, then the PIN gate is bypassed and the acknowledge step renders directly',
        async () => {
            // Mirror image of the PIN-configured test above. With no
            // PIN saved in the typed-secret store, `checkPinEnabled`
            // resolves to false and `useViewPassphraseFlow` skips
            // step='pin' altogether — the acknowledge sheet should be
            // the very first thing the user sees, and the PinEditView
            // bottom sheet (the numpad host) should never mount.
            const account = await seedAlgo25Account()
            const { result: pinHook } = renderHook(() => usePinCode())
            await waitFor(async () => {
                expect(await pinHook.current.checkPinEnabled()).toBe(false)
            })

            render(<ViewPassphraseHost address={account.address} />)

            fireEvent.click(screen.getByTestId('open_view_passphrase'))
            await waitFor(() => {
                expect(
                    screen.getByTestId(
                        'passphrase_acknowledge_bottom_sheet_reveal',
                    ),
                ).toBeTruthy()
            })
            expect(screen.queryByTestId('PWNumpad')).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
