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

import React, { Children, isValidElement, useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    act,
    fireEvent,
    renderHook,
    screen,
    waitFor,
} from '@testing-library/react'

import {
    chainAccountOf,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { parseEthereumPrivateKey } from '@perawallet/wallet-core-chain-ethereum'
import { useKMS, type HDWalletKeyResult } from '@perawallet/wallet-core-kms'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { render } from '@test-utils/render'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import { isElementDisabled } from '@test-utils/rnw'
import { BottomSheetManager, useBottomSheet } from '@modules/bottom-sheet'
import { AccountOptionsContent } from '@modules/accounts/components/AccountOptionsContent'
import { ImportPrivateKeyScreen } from '@modules/onboarding/screens/ImportPrivateKeyScreen/ImportPrivateKeyScreen'
import { NameAccountScreen } from '@modules/onboarding/screens/NameAccountScreen/NameAccountScreen'
import { WatchAccountScreen } from '@modules/onboarding/screens/WatchAccountScreen/WatchAccountScreen'
import { useOnboardingStore } from '@modules/onboarding/hooks/useOnboardingStore'
import { AddAccountStackNavigator } from '@modules/onboarding/routes/add-account'
import { AnalyticsMetadataKey, OnboardingEvent } from '@analytics'

import {
    HD_TEST_ADDRESS,
    HD_TEST_MNEMONIC_24_INDICES,
} from './__fixtures__/onboarding'
import { SLOW_WAIT_TIMEOUT_MS } from './__fixtures__/timeouts'
import {
    recordAnalyticsEvents,
    type AnalyticsRecorder,
} from '@test-utils/analytics-recorder'
import { expectFlowEvents } from './__fixtures__/analytics-flows'

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

const ETHEREUM = 'ethereum'

// Hardhat's first development account: a published test key.
const TEST_PRIVATE_KEY =
    'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const TEST_PRIVATE_KEY_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const WATCH_ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'

const HD_ACCOUNT_ID = 'hd-root'

const seedHdWallet = async (): Promise<WalletAccount> => {
    const { result: kms } = renderHook(() => useKMS())
    let rootKey: HDWalletKeyResult | null = null
    await act(async () => {
        rootKey = await kms.current.createHDWalletKey({
            mnemonicIndices: HD_TEST_MNEMONIC_24_INDICES,
        })
        expect(rootKey).not.toBeNull()
    })
    const account: WalletAccount = {
        id: HD_ACCOUNT_ID,
        custody: {
            kind: 'local',
            seed: 'bip39',
            hd: { account: 0, keyIndex: 0 },
        },
        chains: {
            algorand: {
                address: HD_TEST_ADDRESS,
                keyPairId: rootKey!.seedKey.id ?? '',
            },
        },
        name: 'HD Root',
    }
    useAccountsStore.getState().setAccounts([account])
    return account
}

const additionalScreens = [
    { name: 'NameAccount', component: NameAccountScreen },
]

const renderImportPrivateKey = () =>
    renderWithNavigation(ImportPrivateKeyScreen, 'ImportPrivateKey', {
        initialParams: { chainId: ETHEREUM },
        additionalScreens,
    })

const renderWatchAccount = () =>
    renderWithNavigation(WatchAccountScreen, 'WatchAccount', {
        additionalScreens,
    })

const screenNamesIn = (node: React.ReactNode): string[] =>
    Children.toArray(node).flatMap(child => {
        if (!isValidElement(child)) return []
        const props = child.props as {
            name?: string
            children?: React.ReactNode
        }
        return props.name ? [props.name] : screenNamesIn(props.children)
    })

// The harness swaps in an in-memory navigator, so read the registered screens
// off the element tree the stack navigator returns.
const addAccountRouteNames = (): string[] => {
    const { result } = renderHook(() => AddAccountStackNavigator())
    return screenNamesIn(
        (result.current.props as { children: React.ReactNode }).children,
    )
}

const importKey = async (key: string): Promise<void> => {
    const input = await waitFor(() =>
        screen.getByTestId('import_private_key_input'),
    )
    fireEvent.change(input, { target: { value: key } })
    await waitFor(() =>
        expect(
            isElementDisabled(
                screen.getByTestId('import_private_key_submit_button'),
            ),
        ).toBe(false),
    )
    fireEvent.click(screen.getByTestId('import_private_key_submit_button'))
}

const finishNaming = async (name: string): Promise<void> => {
    await waitFor(() => screen.getByTestId('name_account_finish_button'), {
        timeout: SLOW_WAIT_TIMEOUT_MS,
    })
    fireEvent.change(screen.getByTestId('name_account_name_input'), {
        target: { value: name },
    })
    fireEvent.click(screen.getByTestId('name_account_finish_button'))
    await waitFor(() =>
        expect(
            useAccountsStore.getState().accounts.some(a => a.name === name),
        ).toBe(true),
    )
}

const ethereumAccounts = (): WalletAccount[] =>
    useAccountsStore
        .getState()
        .accounts.filter(a => chainAccountOf(a, ETHEREUM) !== undefined)

const ethereumAddressOf = (account: WalletAccount | undefined) =>
    account && chainAccountOf(account, ETHEREUM)?.address.toLowerCase()

const AccountOptionsHost = ({ account }: { account: WalletAccount }) => {
    const { request } = useBottomSheet()
    useEffect(() => {
        void request({
            contents: (
                <AccountOptionsContent
                    account={account}
                    onShowAddress={() => {}}
                />
            ),
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    return <BottomSheetManager />
}

describe('Flow: Add an Ethereum account', () => {
    let analytics: AnalyticsRecorder
    beforeEach(() => {
        analytics = recordAnalyticsEvents()
    })
    afterEach(() => {
        analytics.restore()
    })

    beforeEach(async () => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useOnboardingStore.getState().reset()
        await seedHdWallet()
    })

    afterEach(() => {
        useRemoteConfigStore.getState().resetState()
    })

    it('Given Ethereum is registered, when the user imports a private key, then a standalone Ethereum account holds its address', async () => {
        renderImportPrivateKey()

        await importKey(`0x${TEST_PRIVATE_KEY}`)
        await finishNaming('Imported')

        const imported = ethereumAccounts()
        expect(imported).toHaveLength(1)
        expect(ethereumAddressOf(imported[0])).toBe(
            TEST_PRIVATE_KEY_ADDRESS.toLowerCase(),
        )
        expect(imported[0]?.custody).toEqual({ kind: 'local', seed: null })
        expect(useAccountsStore.getState().accounts).toHaveLength(2)
        // No Algorand counterpart: the import reuses Name Account's events.
        expect(
            analytics.events([
                OnboardingEvent.NameAccount,
                OnboardingEvent.RegisterAccount,
            ]),
        ).toEqual([
            {
                name: OnboardingEvent.NameAccount,
                payload: { [AnalyticsMetadataKey.ChainId]: 'ethereum' },
            },
            {
                name: OnboardingEvent.RegisterAccount,
                payload: {
                    // The catalogue has no import type; Name Account reports any local key as 'create'.
                    [AnalyticsMetadataKey.AccountCreationType]: 'create',
                    [AnalyticsMetadataKey.ChainId]: 'ethereum',
                },
            },
        ])
    })

    it('Given a key already held, when the user imports it again, then no second account is created', async () => {
        await useAccountsStore
            .getState()
            .importAccountFromPrivateKey(
                ETHEREUM,
                parseEthereumPrivateKey(TEST_PRIVATE_KEY),
            )
        renderImportPrivateKey()

        await importKey(TEST_PRIVATE_KEY)

        await waitFor(() =>
            expect(
                isElementDisabled(
                    screen.getByTestId('import_private_key_submit_button'),
                ),
            ).toBe(true),
        )
        expect(screen.queryByTestId('name_account_finish_button')).toBeNull()
        expect(ethereumAccounts()).toHaveLength(1)
    })

    it('Given Ethereum is registered, when the user watches a 0x address, then a watch account on Ethereum is named from that address', async () => {
        renderWatchAccount()

        fireEvent.change(
            await waitFor(() =>
                screen.getByTestId('watch_account_address_input'),
            ),
            { target: { value: WATCH_ADDRESS } },
        )
        await waitFor(() =>
            expect(
                isElementDisabled(
                    screen.getByTestId('watch_account_submit_button'),
                ),
            ).toBe(false),
        )
        fireEvent.click(screen.getByTestId('watch_account_submit_button'))
        await finishNaming('Watched')

        const watched = ethereumAccounts()
        expect(watched).toHaveLength(1)
        expect(watched[0]?.custody).toEqual({ kind: 'watch' })
        expect(ethereumAddressOf(watched[0])).toBe(WATCH_ADDRESS)
        expectFlowEvents(analytics, 'addWatchAccount', 'ethereum')
    })

    it('Given private keys are on for Ethereum, then the add-account stack registers the private-key import', () => {
        expect(addAccountRouteNames()).toContain('ImportPrivateKey')
    })

    it('Given private keys are off for Ethereum, then the add-account stack has no private-key import', () => {
        setCapabilityOverrides({ privateKeys: false }, ETHEREUM)

        const routeNames = addAccountRouteNames()

        expect(routeNames).not.toContain('ImportPrivateKey')
        expect(routeNames).toContain('AddAccountHome')
    })

    it('Given private keys are off for Ethereum, when an imported account opens its options, then View private key is absent', async () => {
        const imported = await useAccountsStore
            .getState()
            .importAccountFromPrivateKey(
                ETHEREUM,
                parseEthereumPrivateKey(TEST_PRIVATE_KEY),
            )
        setCapabilityOverrides({ privateKeys: false }, ETHEREUM)

        render(<AccountOptionsHost account={imported} />)

        await waitFor(() => screen.getByTestId('account_option_rename-account'))
        expect(
            screen.queryByTestId('account_option_view-private-key'),
        ).toBeNull()
    })

    it('Given private keys are on, when an imported account opens its options, then View private key is offered', async () => {
        const imported = await useAccountsStore
            .getState()
            .importAccountFromPrivateKey(
                ETHEREUM,
                parseEthereumPrivateKey(TEST_PRIVATE_KEY),
            )

        render(<AccountOptionsHost account={imported} />)

        expect(
            await screen.findByTestId('account_option_view-private-key'),
        ).toBeTruthy()
    })
})
