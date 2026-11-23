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

import { describe, expect, it, vi } from 'vitest'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { ETHEREUM } from '../../__tests__/evm-chains'
import { evmHistoryItem } from '../api/msw-handlers'
import { evmHistoryItemSchema } from '../api/schema'
import {
    EVM_HISTORY_CSV_MAX_ROWS,
    exportStoredEvmHistoryCsv,
} from '../csv-export'
import { readStoredEvmHistory } from '../history-cache'

vi.mock('../history-cache')

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ME = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'

const itemOf = (n: number) =>
    evmHistoryItemSchema.parse(
        evmHistoryItem({ hash: `0x${n.toString(16).padStart(64, '0')}` }),
    )

describe('exportStoredEvmHistoryCsv past the row cap', () => {
    it('writes the cap and marks the file as truncated', async () => {
        vi.mocked(readStoredEvmHistory).mockResolvedValue(
            Array.from({ length: EVM_HISTORY_CSV_MAX_ROWS + 1 }, (_, n) =>
                itemOf(n + 1),
            ),
        )

        const result = await exportStoredEvmHistoryCsv(ETHEREUM, {
            accountAddress: ME,
            scope: SCOPE,
        })

        expect(result.rowCount).toBe(EVM_HISTORY_CSV_MAX_ROWS)
        expect(result.filename).toBe(
            'TRUNCATED-Transactions-1-0x5aae--eaed-Pera.csv',
        )
    })

    it('asks the store for one row more than the cap', async () => {
        vi.mocked(readStoredEvmHistory).mockResolvedValue([])

        await exportStoredEvmHistoryCsv(ETHEREUM, {
            accountAddress: ME,
            scope: SCOPE,
        })

        expect(readStoredEvmHistory).toHaveBeenLastCalledWith(
            expect.objectContaining({ limit: EVM_HISTORY_CSV_MAX_ROWS + 1 }),
        )
    })
})
