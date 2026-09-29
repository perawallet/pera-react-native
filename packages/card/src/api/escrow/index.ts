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

import type { Network } from '@perawallet/wallet-core-shared'
import { cardAdapterFor, type EscrowChainConfig } from '../../chain-adapter'

export {
    AutoDrawProgramUnverifiedError,
    AutoDrawTealUnverifiedError,
    CardEscrowNotConfiguredError,
} from './errors'

/** @throws CardEscrowNotConfiguredError when the build lacks an id. */
export const resolveEscrowChainConfig = (network: Network): EscrowChainConfig =>
    cardAdapterFor(network).resolveEscrowChainConfig(network)

/**
 * The program the funding account signs to let the card draw from it, verified
 * against the build's pins before it is returned.
 */
export const compileAutoDrawProgram = async ({
    network,
}: {
    network: Network
}): Promise<Uint8Array> =>
    cardAdapterFor(network).compileAutoDrawProgram(network)
