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

import { afterAll, beforeAll, describe } from 'vitest'
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import { deeplinkAdapterContractTests } from '@perawallet/wallet-core-deeplinks/testing'
import { createEvmAddressCodec } from '../../accounts/address-codec'
import { createEvmDeeplinkAdapter } from '../adapter'
import { eip155IdOf, EVM_TEST_CHAINS } from '../../__tests__/evm-chains'

// Each chain as the only one registered, so it owns the scheme and every
// link it reads is its own. Every link names its chain: one without is chain
// 1's, and is refused when only another chain is registered.
for (const chain of EVM_TEST_CHAINS) {
    const codec = createEvmAddressCodec(chain)
    const mainnet = eip155IdOf(chain)
    const testnet = eip155IdOf(chain, 'testnet')

    describe(chain.row.id, () => {
        beforeAll(() => {
            addressCodecs.reset()
            addressCodecs.register(codec)
        })
        afterAll(() => addressCodecs.reset())

        deeplinkAdapterContractTests(() => createEvmDeeplinkAdapter(chain), {
            codec,
            links: [
                `ethereum:0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359@${mainnet}?value=2.014e18`,
                `ethereum:pay-0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266@${mainnet}?value=1000000000000000000`,
                `ethereum:0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7@${mainnet}/transfer?address=0x8e23ee67d1332ad560396262c48ffbb01f93d052&uint256=1`,
                `ethereum:0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359@${testnet}/transfer?address=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266&uint256=1500000`,
            ],
        })
    })
}
