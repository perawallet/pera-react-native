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

import { Decimal } from 'decimal.js'
import { addressCodecContractTests } from '@perawallet/wallet-core-chain-contract/testing'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { algorandAddressCodec } from '../address-codec'

const VALID = 'EV37KES2XMAYPUQ5YT5T62RUC5LHNKERPH5QCAJFQF3735U7SE6BU5UQWM'

addressCodecContractTests(() => algorandAddressCodec, {
    publicKey: new Uint8Array(32).fill(9),
    deriveOpts: { scheme: 'ed25519', networkId: 'mainnet' },
    invalid: [
        VALID.toLowerCase(),
        `${VALID.slice(0, -1)}A`,
        VALID.slice(1),
        '0x52908400098527886E0F7030069857D2E4169EE7',
    ],
    foreignUri: `ethereum:0x52908400098527886E0F7030069857D2E4169EE7`,
    paymentUriOpts: {
        assetRef: { chainId: ALGORAND_CHAIN_ID, assetId: '31566704' },
        amount: new Decimal('1500000'),
        label: 'Coffee',
        note: 'thanks',
    },
})
