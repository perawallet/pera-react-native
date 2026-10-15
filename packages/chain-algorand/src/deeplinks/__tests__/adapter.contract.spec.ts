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

import { deeplinkAdapterContractTests } from '@perawallet/wallet-core-deeplinks/testing'
import { algorandAddressCodec } from '../../accounts/address-codec'
import { algorandDeeplinkAdapter } from '../adapter'

const ADDR = '5CYNWZY5JO7RWAPEQLWOTDULMDSSKJ55PHXNRTGZXUR62B7PR7JIDJGHEA'

deeplinkAdapterContractTests(() => algorandDeeplinkAdapter, {
    codec: algorandAddressCodec,
    links: [
        `algorand://${ADDR}`,
        `algorand://${ADDR}?amount=1000000&note=hi&xnote=x`,
        `algorand://${ADDR}?amount=0&asset=31566704`,
        'algorand://?amount=0&asset=31566704',
        'algorand://net:testnet-v1.0/asset/31566704',
        'algorand://app/7890',
        `algorand://${ADDR}?type=keyreg&votekey=a&selkey=b&sprfkey=c&votefst=1&votelst=2&votekd=3&fee=1000`,
        `algo:${ADDR}`,
        `algo:31566704/transfer?address=${ADDR}`,
        'algorand-wc:test@1?bridge=test&key=test',
        `algorand://wc?uri=${encodeURIComponent('wc:test@1?bridge=test&key=test')}`,
    ],
})
