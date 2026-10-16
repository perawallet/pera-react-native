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

import Eth from '@ledgerhq/hw-app-eth'
import type { LedgerAppDriver } from '@perawallet/wallet-extension-hardware-wallet'
import { ETHEREUM_CHAIN_ID } from '../chain-id'
import { createEthereumLedgerTransport } from './transport'

type EthAppTransport = ConstructorParameters<typeof Eth>[0]

export const ethereumLedgerAppDriver: LedgerAppDriver = {
    chainId: ETHEREUM_CHAIN_ID,
    open: (transport, classifyError) =>
        createEthereumLedgerTransport(
            transport,
            // Sound only because the transport extensions pass the real
            // `@ledgerhq/hw-transport` instance (see LedgerAppTransport).
            new Eth(transport as EthAppTransport),
            classifyError,
        ),
}
