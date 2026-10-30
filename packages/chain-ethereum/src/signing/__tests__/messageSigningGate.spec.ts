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

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { toHex } from 'viem'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { dappRequestFailureOf } from '@perawallet/wallet-core-connections'
import { CannotSignError } from '@perawallet/wallet-core-signing'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { evmCapabilityDefaults } from '../../capability-defaults'
import { ETHEREUM } from '../../__tests__/evm-chains'
import { withMessageSigningGate } from '../messageSigningGate'
import {
    createEvmMessageSignerAdapter,
    personalSignMessageRequest,
} from '../messages'
import { ETHEREUM_SIGNER_ACCOUNT, SENDER } from './fixtures'

const MAINNET: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const context = {
    account: ETHEREUM_SIGNER_ACCOUNT,
    accounts: [ETHEREUM_SIGNER_ACCOUNT],
}
const request = personalSignMessageRequest(MAINNET, SENDER, toHex('hello'))
const adapter = withMessageSigningGate(
    ETHEREUM,
    createEvmMessageSignerAdapter(ETHEREUM),
)
const { chains } = getProvider()

const refusalOf = (): Error => {
    try {
        adapter.plan(request, context)
    } catch (error) {
        return error as Error
    }
    throw new Error('plan did not refuse')
}

beforeEach(() => {
    chains.reset()
    chains.register(ETHEREUM.descriptor, evmCapabilityDefaults)
})

afterEach(() => chains.reset())

describe('withMessageSigningGate', () => {
    it('plans as the wrapped signer while messageSigning is on', () => {
        expect(adapter.plan(request, context)).toEqual(
            createEvmMessageSignerAdapter(ETHEREUM).plan(request, context),
        )
    })

    it('refuses a plan made after the switch goes off, as a non-retryable signing refusal a dApp reads as unsupported-method', () => {
        expect(adapter.plan(request, context)).toHaveLength(1)

        chains.setCapabilityOverrides(() => ({
            remote: { ethereum: { messageSigning: false } },
        }))
        const refusal = refusalOf()

        expect(refusal).toBeInstanceOf(CannotSignError)
        expect(dappRequestFailureOf(refusal)).toBe('unsupported-method')
        expect(refusal.message).toContain('message signing is off on')
    })

    it('fails closed for a chain the registry does not hold', () => {
        chains.reset()

        expect(dappRequestFailureOf(refusalOf())).toBe('unsupported-method')
    })

    it('fails closed while the chain kill switch is off', () => {
        chains.setCapabilityOverrides(() => ({
            chainEnabled: { ethereum: false },
        }))

        expect(dappRequestFailureOf(refusalOf())).toBe('unsupported-method')
    })
})
