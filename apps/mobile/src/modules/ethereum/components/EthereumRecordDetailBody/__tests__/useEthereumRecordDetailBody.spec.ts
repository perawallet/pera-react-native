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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    i18nKey,
    type I18nKey,
    type TransactionNative,
    type TransactionRecord,
    type TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import {
    useEthereumRecordDetail,
    type UseEthereumRecordDetailResult,
} from '../../../hooks/useEthereumRecordDetail'
import { useEthereumRecordDetailBody } from '../useEthereumRecordDetailBody'

vi.mock('../../../hooks/useEthereumRecordDetail', () => ({
    useEthereumRecordDetail: vi.fn(),
}))

const SETTLED: UseEthereumRecordDetailResult = {
    transaction: null,
    isLoading: false,
    isReadFailed: false,
    isDecoding: true,
}

const read = (overrides: Partial<UseEthereumRecordDetailResult> = {}) =>
    vi.mocked(useEthereumRecordDetail).mockReturnValue({
        ...SETTLED,
        ...overrides,
    })

const recordOf = (
    titleKey: I18nKey,
    overrides: Partial<TransactionSummary> = {},
): TransactionRecord => ({
    id: `0x${'1'.padStart(64, '0')}`,
    scope: { chainId: 'ethereum', networkId: 'mainnet' },
    status: 'confirmed',
    summary: {
        kind: 'contract-call',
        title: { key: titleKey },
        direction: 'none',
        icon: 'contract-call',
        ...overrides,
    },
    chainData: { family: 'evm' },
})

const SWAP_PAIR = i18nKey('transactions.list_item.swap_pair')
const inferredSwap = recordOf(SWAP_PAIR, {
    kind: 'swap',
    icon: 'swap',
    isInferred: true,
})

const bodyOf = (record: TransactionRecord) =>
    renderHook(() => useEthereumRecordDetailBody(record)).result.current

describe('useEthereumRecordDetailBody', () => {
    beforeEach(() => {
        read()
    })

    it('Given a title guessed from the balance changes and no read to replace it, then it says so, and not that the call is unknown', () => {
        const body = bodyOf(inferredSwap)

        expect(body.isInferredTitle).toBe(true)
        expect(body.isUndecodedCall).toBe(false)
    })

    it('Given a guessed title whose node read failed, then it still says the title was guessed', () => {
        read({ isReadFailed: true })

        expect(bodyOf(inferredSwap).isInferredTitle).toBe(true)
    })

    it('Given a guessed title while the node read is in flight, then it says nothing yet', () => {
        read({ isLoading: true })

        expect(bodyOf(inferredSwap).isInferredTitle).toBe(false)
    })

    it('Given a guessed title the node read explains, then the read is shown and nothing is flagged', () => {
        const transaction = { family: 'evm' } as TransactionNative
        read({ transaction })

        const body = bodyOf(inferredSwap)

        expect(body.transaction).toBe(transaction)
        expect(body.isInferredTitle).toBe(false)
    })

    it('Given a known contract named by its method, then nothing is flagged', () => {
        const body = bodyOf(
            recordOf(i18nKey('transactions.list_item.supply'), {
                subtitle: {
                    key: i18nKey('transactions.list_item.interpreted_title'),
                    params: { title: 'Aave V3 Pool' },
                },
            }),
        )

        expect(body.isInferredTitle).toBe(false)
        expect(body.isUndecodedCall).toBe(false)
    })

    const unknownCall = recordOf(
        i18nKey('transactions.list_item.interpreted_title'),
        { isActionUnknown: true },
    )

    it('Given a call whose summary names no action, then it keeps the notice that the call is unknown', () => {
        const body = bodyOf(unknownCall)

        expect(body.isUndecodedCall).toBe(true)
        expect(body.isInferredTitle).toBe(false)
    })

    it("Given a call whose summary doesn't say it names no action, then there is no unknown-call notice, whatever its title's key", () => {
        const body = bodyOf(
            recordOf(i18nKey('transactions.list_item.contract_interaction')),
        )

        expect(body.isUndecodedCall).toBe(false)
    })

    it('Given a call that names no action whose read failed, then the unknown-call notice gives way to the read failure', () => {
        read({ isReadFailed: true })

        expect(bodyOf(unknownCall).isUndecodedCall).toBe(false)
    })
})
