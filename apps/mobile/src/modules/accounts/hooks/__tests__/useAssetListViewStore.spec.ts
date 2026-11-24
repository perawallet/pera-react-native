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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import {
    useAssetListViewStore,
    watchSelectedAccount,
} from '../useAssetListViewStore'

vi.unmock('@perawallet/wallet-core-accounts')

describe('useAssetListViewStore', () => {
    beforeEach(() => {
        useAssetListViewStore.setState({
            selectedChainId: null,
            expandedGroupIds: [],
        })
    })

    it('starts on All with every group collapsed', () => {
        const { selectedChainId, expandedGroupIds } =
            useAssetListViewStore.getState()

        expect(selectedChainId).toBeNull()
        expect(expandedGroupIds).toEqual([])
    })

    it('records the selected chain and clears it back to All', () => {
        useAssetListViewStore.getState().setSelectedChainId('ethereum')
        expect(useAssetListViewStore.getState().selectedChainId).toBe(
            'ethereum',
        )

        useAssetListViewStore.getState().setSelectedChainId(null)
        expect(useAssetListViewStore.getState().selectedChainId).toBeNull()
    })

    it('toggles a group open and closed without touching the others', () => {
        const { toggleGroupExpanded } = useAssetListViewStore.getState()

        toggleGroupExpanded('usdc')
        toggleGroupExpanded('usdt')
        toggleGroupExpanded('usdc')

        expect(useAssetListViewStore.getState().expandedGroupIds).toEqual([
            'usdt',
        ])
    })

    describe('watchSelectedAccount', () => {
        let unwatch: () => void

        beforeEach(() => {
            useAccountsStore.setState({ selectedAccountId: 'first' })
            useAssetListViewStore.getState().setSelectedChainId('base')
            unwatch = watchSelectedAccount()
        })

        afterEach(() => unwatch())

        it('starts the network chip on All when another account is selected', () => {
            useAccountsStore.setState({ selectedAccountId: 'second' })

            expect(useAssetListViewStore.getState().selectedChainId).toBeNull()
        })

        it('keeps the network chip while the same account stays selected', () => {
            useAccountsStore.setState({ selectedAccountId: 'first' })

            expect(useAssetListViewStore.getState().selectedChainId).toBe(
                'base',
            )
        })

        it('stops following the selection once unwatched', () => {
            unwatch()

            useAccountsStore.setState({ selectedAccountId: 'second' })

            expect(useAssetListViewStore.getState().selectedChainId).toBe(
                'base',
            )
        })
    })
})
