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

import {
    createHdEvmAccount,
    fundEvmAccount,
    nativeBalanceOf,
} from '../../harness/accounts'
import { castAddressFromMnemonic } from '../../harness/cast'
import { createEvmConformanceSession, envFor } from '../../harness/context'
import { EVMNET, EVMNET_CHAINS } from '../../harness/evmnet'
import {
    buildTransfer,
    expectEvmConformant,
    signAndSend,
} from '../construction/support'

/**
 * Runs the core path on every EVM chain Pera ships, each on its own node and
 * testnet chain id: an HD account derived by the app, funded, sends a native
 * transfer built, signed and broadcast by the app under that chain's fee
 * strategy, and the three proofs hold. A mock can't show each chain's node
 * accepts what the app signs for it, or charges what the app priced.
 */
describe('evm chain matrix', () => {
    it.each(EVMNET_CHAINS)(
        'derives, funds and sends a native transfer on %s',
        async chain => {
            const session = await createEvmConformanceSession()
            const env = envFor(session, chain)
            const sender = await createHdEvmAccount(env, { index: 3 })
            const recipient = await createHdEvmAccount(env, { index: 4 })
            // Oracle parity: the app derives the address cast derives.
            expect(sender.address).toBe(
                await castAddressFromMnemonic({
                    mnemonic: sender.mnemonic!,
                    index: 3,
                }),
            )
            await fundEvmAccount(env, sender.address, 10n ** 18n)
            const value = 10n ** 15n + 1n

            const { unsigned, fees } = await buildTransfer(env, {
                from: sender.address,
                to: recipient.address,
                assetRef: env.evmChain.descriptor.nativeAsset.ref,
                amount: value,
            })
            const { raw, hash } = await signAndSend(env, sender, unsigned)

            // Round-trip: bytes, node transaction and balance delta (Base's L1 fee included) under this chain's id.
            await expectEvmConformant({
                env,
                intent: {
                    chainId: EVMNET[chain].eip155ChainId,
                    from: sender.address,
                    nonce: 0,
                    to: recipient.address,
                    value,
                    // App-chosen: gas and fee caps.
                    ...fees,
                },
                raw,
                hash,
            })
            // Node acceptance: the recipient is credited exactly.
            expect(await nativeBalanceOf(env, recipient.address)).toBe(value)
        },
    )
})
