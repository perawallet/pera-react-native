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

import { describe, expect, it } from 'vitest'

import { parseCastReceipt } from '../cast'

const RECEIPT = {
    status: '0x1',
    transactionHash:
        '0xc867a50ca92180865c5954f3055c24bc6e1c899e84b035d70cc1fce2eac5fc01',
    contractAddress: null,
}

describe('parseCastReceipt', () => {
    it('reads the receipt cast send --json prints', () => {
        expect(parseCastReceipt(`${JSON.stringify(RECEIPT)}\n`)).toEqual(
            RECEIPT,
        )
    })

    it('reads the receipt line when cast prints another document after it', () => {
        const stdout = `${JSON.stringify(RECEIPT)}\n${JSON.stringify({ ...RECEIPT, status: '0x0' })}`

        expect(parseCastReceipt(stdout)).toEqual(RECEIPT)
    })

    it('rejects output with no receipt', () => {
        expect(() => parseCastReceipt('')).toThrow(SyntaxError)
    })
})
