/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
*/

import { describe, it, expect } from 'vitest'
import { selectProtocol } from '../selectProtocol'
import type { NegotiateOffer, WalletProtocol } from '../types'

const offer = (protocols: NegotiateOffer['protocols']): NegotiateOffer => ({
    id: 'o',
    handshakeVersion: 1,
    protocols,
})

describe('selectProtocol', () => {
    it('picks the wallet-preferred protocol even when the dApp lists it second', () => {
        const wallet: WalletProtocol[] = [
            { id: 'arc0027', versions: ['1.0'] },
            { id: 'walletconnect', versions: ['2.0'] },
        ]
        const result = selectProtocol(
            wallet,
            offer([
                { id: 'walletconnect', versions: ['2.0'] },
                { id: 'arc0027', versions: ['1.0'] },
            ]),
        )
        expect(result).toEqual({ id: 'arc0027', version: '1.0' })
    })

    it('picks the highest mutually-supported version', () => {
        const wallet: WalletProtocol[] = [
            { id: 'arc0027', versions: ['1.0', '1.1', '2.0'] },
        ]
        const result = selectProtocol(
            wallet,
            offer([{ id: 'arc0027', versions: ['1.0', '1.1'] }]),
        )
        expect(result).toEqual({ id: 'arc0027', version: '1.1' })
    })

    it('returns null when no protocol overlaps', () => {
        const wallet: WalletProtocol[] = [{ id: 'arc0027', versions: ['1.0'] }]
        const result = selectProtocol(
            wallet,
            offer([{ id: 'walletconnect', versions: ['2.0'] }]),
        )
        expect(result).toBeNull()
    })

    it('returns null when the protocol matches but no version overlaps', () => {
        const wallet: WalletProtocol[] = [{ id: 'arc0027', versions: ['1.0'] }]
        const result = selectProtocol(
            wallet,
            offer([{ id: 'arc0027', versions: ['9.9'] }]),
        )
        expect(result).toBeNull()
    })
})
