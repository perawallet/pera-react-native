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
    type TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import { useOpenRecordDetails } from '../useOpenRecordDetails'

const mockNavigate = vi.hoisted(() => vi.fn())

vi.mock('@react-navigation/native', async importOriginal => ({
    ...(await importOriginal<typeof import('@react-navigation/native')>()),
    useNavigation: () => ({ navigate: mockNavigate }),
}))

const RECORD: TransactionRecord = {
    id: `0x${'ab'.repeat(32)}`,
    scope: { chainId: 'ethereum', networkId: 'mainnet' },
    status: 'confirmed',
    summary: {
        kind: 'contract-call',
        title: { key: i18nKey('transactions.list_item.contract_call') },
        direction: 'none',
        icon: 'contract-call',
    },
    chainData: { family: 'evm' },
}

describe('useOpenRecordDetails', () => {
    beforeEach(() => vi.clearAllMocks())

    it('opens the transaction details screen on the record', () => {
        const { result } = renderHook(() => useOpenRecordDetails(RECORD))

        result.current.handleOpenDetails?.()

        expect(mockNavigate).toHaveBeenCalledWith('TransactionDetails', {
            scope: RECORD.scope,
            transactionId: RECORD.id,
            historyRecord: RECORD,
        })
    })

    it('offers nothing without a record', () => {
        const { result } = renderHook(() => useOpenRecordDetails(undefined))

        expect(result.current.handleOpenDetails).toBeUndefined()
    })
})
