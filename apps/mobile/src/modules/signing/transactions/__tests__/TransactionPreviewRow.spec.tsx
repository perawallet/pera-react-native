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

import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@test-utils/render'
import type { TransactionNative } from '@perawallet/wallet-core-chain-contract'
import { buildAlgorandDisplayFixture } from '@test-utils/algorand-display-fixtures'
import { TransactionPreviewRow } from '../TransactionPreviewRow'

// The global mock stubs the blockchain barrel; the row classifies with the real utils.
vi.mock('@perawallet/wallet-core-chain-algorand/blockchain', async () => ({
    ...(await vi.importActual<
        typeof import('@packages/chain-algorand/src/blockchain/utils/transactions')
    >('@packages/chain-algorand/src/blockchain/utils/transactions')),
    ...(await vi.importActual<
        typeof import('@packages/chain-algorand/src/blockchain/models/transaction-view')
    >('@packages/chain-algorand/src/blockchain/models/transaction-view')),
    ...(await vi.importActual<
        typeof import('@packages/chain-algorand/src/blockchain/utils/addresses')
    >('@packages/chain-algorand/src/blockchain/utils/addresses')),
}))

vi.mock('@perawallet/wallet-core-nfd', () => ({
    useNfdForAddressQuery: () => ({ data: undefined }),
}))

// lanekeep-ignore-next-line pera/no-module-component-specs reason: asserts what the user sees before signing, the security boundary of the review
describe('TransactionPreviewRow', () => {
    it("renders the transaction's family row and forwards the press", () => {
        const onPress = vi.fn()

        render(
            <TransactionPreviewRow
                transaction={buildAlgorandDisplayFixture('payment')}
                isExternal
                onPress={onPress}
            />,
        )
        fireEvent.click(screen.getByTestId('transaction_preview_row'))

        expect(onPress).toHaveBeenCalledTimes(1)
        expect(
            screen.getByTestId('transaction-preview-external-pill'),
        ).toBeTruthy()
    })

    it('renders nothing for a family with no row', () => {
        const evm: TransactionNative = { family: 'evm', transaction: {} }

        render(<TransactionPreviewRow transaction={evm} />)

        expect(screen.queryByTestId('transaction_preview_row')).toBeNull()
    })
})
