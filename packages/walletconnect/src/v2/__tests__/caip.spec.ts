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
import { Networks } from '@perawallet/wallet-core-shared'
import {
    CAIP2_CHAIN_ID_BY_NETWORK,
    getCaip2ChainId,
    getNetworkFromCaip2ChainId,
    parseAlgorandCaip10Account,
    parseCaip10Account,
    toCaip2ChainId,
} from '../caip'

// The registered ids from the Chain Agnostic `algorand` namespace. Hard-coded
// on purpose: the implementation derives them from config's genesis hashes, so
// comparing against the published values catches a typo on either side.
const MAINNET_CHAIN_ID = 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'
const TESTNET_CHAIN_ID = 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe'
const BETANET_CHAIN_ID = 'algorand:mFgazF-2uRS1tMiL9dsj01hJGySEmPN2'

describe('getCaip2ChainId', () => {
    it('derives mainnet, testnet and betanet from their genesis hashes', () => {
        expect(getCaip2ChainId(Networks.mainnet)).toBe(MAINNET_CHAIN_ID)
        expect(getCaip2ChainId(Networks.testnet)).toBe(TESTNET_CHAIN_ID)
        expect(getCaip2ChainId(Networks.betanet)).toBe(BETANET_CHAIN_ID)
    })

    it("encodes betanet's genesis hash with the URL-safe alphabet", () => {
        // BetaNet's base64 genesis hash contains `+` within the first 32
        // characters; plain base64 would produce an id no dApp presents.
        expect(getCaip2ChainId(Networks.betanet)).toContain('mFgazF-2')
    })

    it('truncates the reference to 32 characters and drops base64 padding', () => {
        for (const network of [
            Networks.mainnet,
            Networks.testnet,
            Networks.betanet,
        ]) {
            const reference = getCaip2ChainId(network)?.split(':')[1] ?? ''
            expect(reference).toHaveLength(32)
            expect(reference).toMatch(/^[-_a-zA-Z0-9]{32}$/)
        }
    })

    it('has no chain id for custom', () => {
        expect(getCaip2ChainId(Networks.custom)).toBeNull()
    })

    it('maps every network', () => {
        expect(CAIP2_CHAIN_ID_BY_NETWORK).toEqual({
            mainnet: MAINNET_CHAIN_ID,
            testnet: TESTNET_CHAIN_ID,
            betanet: BETANET_CHAIN_ID,
            custom: null,
        })
    })

    it('refuses to let a caller repoint a network', () => {
        expect(() =>
            Object.assign(CAIP2_CHAIN_ID_BY_NETWORK, {
                [Networks.mainnet]: TESTNET_CHAIN_ID,
            }),
        ).toThrow(TypeError)
        expect(getCaip2ChainId(Networks.mainnet)).toBe(MAINNET_CHAIN_ID)
    })
})

describe('parseCaip10Account', () => {
    const ADDRESS = 'A'.repeat(58)

    it('splits an account into its chain id and bare address', () => {
        expect(parseCaip10Account(`${MAINNET_CHAIN_ID}:${ADDRESS}`)).toEqual({
            chainId: MAINNET_CHAIN_ID,
            address: ADDRESS,
        })
    })

    it('refuses a bare chain id', () => {
        expect(parseCaip10Account(MAINNET_CHAIN_ID)).toBeNull()
    })

    it('refuses a bare address', () => {
        expect(parseCaip10Account(ADDRESS)).toBeNull()
    })

    it('refuses an account with an empty segment', () => {
        expect(parseCaip10Account(`algorand::${ADDRESS}`)).toBeNull()
        expect(parseCaip10Account(`${MAINNET_CHAIN_ID}:`)).toBeNull()
    })

    it('refuses a fourth segment rather than guessing which part is the address', () => {
        expect(
            parseCaip10Account(`${MAINNET_CHAIN_ID}:${ADDRESS}:extra`),
        ).toBeNull()
    })
})

describe('parseAlgorandCaip10Account', () => {
    const ADDRESS = 'A'.repeat(58)

    it('accepts an account on a chain id this wallet knows', () => {
        expect(
            parseAlgorandCaip10Account(`${MAINNET_CHAIN_ID}:${ADDRESS}`),
        ).toEqual({ chainId: MAINNET_CHAIN_ID, address: ADDRESS })
    })

    it('refuses a foreign namespace, which a namespace key does not constrain', () => {
        expect(parseAlgorandCaip10Account('eip155:1:0xabc')).toBeNull()
    })

    it('refuses an algorand chain id this wallet has no network for', () => {
        expect(
            parseAlgorandCaip10Account(`algorand:${'z'.repeat(32)}:${ADDRESS}`),
        ).toBeNull()
    })
})

describe('toCaip2ChainId', () => {
    it('has no id for a genesis hash shorter than the CAIP-2 reference', () => {
        // A blanked env override reaches here as an empty or truncated hash; a
        // bare `algorand:` prefix would match no chain any dApp presents.
        expect(toCaip2ChainId('')).toBeNull()
        expect(toCaip2ChainId('wGHE2Pwdvd7S12BL5FaOP2')).toBeNull()
    })

    it('accepts a hash exactly the reference length', () => {
        expect(toCaip2ChainId('wGHE2Pwdvd7S12BL5FaOP20EGYesN73k')).toBe(
            MAINNET_CHAIN_ID,
        )
    })
})

describe('getNetworkFromCaip2ChainId', () => {
    it('round-trips every network that has a chain id', () => {
        for (const network of [
            Networks.mainnet,
            Networks.testnet,
            Networks.betanet,
        ]) {
            const chainId = getCaip2ChainId(network)
            expect(chainId).not.toBeNull()
            expect(getNetworkFromCaip2ChainId(chainId ?? '')).toBe(network)
        }
    })

    it('refuses an unknown chain id', () => {
        expect(getNetworkFromCaip2ChainId('algorand:notAChainAtAll')).toBeNull()
        expect(getNetworkFromCaip2ChainId('eip155:1')).toBeNull()
        expect(getNetworkFromCaip2ChainId('')).toBeNull()
    })

    it('refuses a plain-base64 chain id, matching only the URL-safe form', () => {
        expect(
            getNetworkFromCaip2ChainId(
                'algorand:mFgazF+2uRS1tMiL9dsj01hJGySEmPN2',
            ),
        ).toBeNull()
    })

    it('refuses an untruncated genesis hash', () => {
        expect(
            getNetworkFromCaip2ChainId(
                'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
            ),
        ).toBeNull()
    })
})
