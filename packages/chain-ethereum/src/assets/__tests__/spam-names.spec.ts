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
import { isSpamNamedToken } from '../spam-names'

const LISTED = new Set(['USDT', 'USDC', 'ETH'])

describe('isSpamNamedToken', () => {
    it.each([
        '✅$SHIB REWARD POOL',
        '$USDT CLAIM ▷ airUSDT.net',
        '✅$PAWS Token Distribution',
        't.me/s/US_CIRCLE | claim until',
        '⭐Airdrop: solshiba.live',
        'Claim on airdrop.avax-meowcat',
        'claim rewards on t.ly/shibaswap',
        'Visit: t.me/s/NFT_PAWS',
        '$NC [CLAIM HERE – nodecoin.rewar',
        'https://example.org',
        'www.freetokens',
        '🎁 Gift',
    ])('flags the airdrop name %s', name => {
        expect(isSpamNamedToken({ name, unitName: 'X' }, LISTED)).toBe(true)
    })

    it('flags a spam unit name even when the name looks plain', () => {
        expect(
            isSpamNamedToken(
                { name: 'Token', unitName: 'claim at t.me/x' },
                LISTED,
            ),
        ).toBe(true)
    })

    it.each(['USDT', '$USDC', ' usdc', 'eth'])(
        'flags a token named after a listed symbol (%s)',
        unitName => {
            expect(
                isSpamNamedToken({ name: 'Tether USD', unitName }, LISTED),
            ).toBe(true)
        },
    )

    it.each([
        { name: 'Reward Token', unitName: 'RWD' },
        { name: 'Distribution DAO', unitName: 'DIST' },
        { name: 'Pepe', unitName: 'PEPE' },
        { name: 'Wrapped Ether', unitName: 'WETH' },
        { name: 'Claimable Yield', unitName: 'CY' },
        { name: null, unitName: null },
    ])('leaves an ordinary token alone ($name)', token => {
        expect(isSpamNamedToken(token, LISTED)).toBe(false)
    })
})
