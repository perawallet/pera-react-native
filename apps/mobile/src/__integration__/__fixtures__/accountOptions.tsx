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

import { type ReactNode, useEffect } from 'react'
import { expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

import {
    chainAccountOf,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useKMS, type HDWalletKeyResult } from '@perawallet/wallet-core-kms'
import { BottomSheetManager, useBottomSheet } from '@modules/bottom-sheet'

import { HD_TEST_ADDRESS, HD_TEST_MNEMONIC_24_INDICES } from './onboarding'

export const HD_ACCOUNT_ID = 'hd-root'

/** Stores a Universal Wallet's first account, named "HD Root", backed by a real HD key. */
export const seedHdAccount = async (): Promise<WalletAccount> => {
    const { result: kms } = renderHook(() => useKMS())
    let rootKey: HDWalletKeyResult | null = null
    await waitFor(async () => {
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

/**
 * A second account in `account`'s wallet. It shares the key id, which is what
 * groups the two; the address is display-only, as no test derives it.
 */
export const hdSiblingOf = (
    account: WalletAccount,
    address: string,
): WalletAccount => ({
    id: 'hd-sibling',
    custody: {
        kind: 'local',
        seed: 'bip39',
        hd: { account: 1, keyIndex: 0 },
    },
    chains: {
        algorand: {
            address,
            keyPairId: chainAccountOf(account, 'algorand')?.keyPairId ?? '',
        },
    },
    name: 'Sibling',
})

// Takes the contents rather than importing a module's sheet: fixtures, unlike
// specs, are held to the module-entry rule.
export const SheetHost = ({ contents }: { contents: ReactNode }) => {
    const { request } = useBottomSheet()
    useEffect(() => {
        void request({
            contents,
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
