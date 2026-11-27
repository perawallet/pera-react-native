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

import type { EmptyReceiveSide } from '@modules/signing'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'

const NOTHING: EmptyReceiveSide = { kind: 'nothing' }
const NOT_DETECTED: EmptyReceiveSide = { kind: 'not-detected' }

/**
 * What an empty receive side says. Only a send is known to bring nothing back;
 * a contract call's simulation sees this network alone, so it is "not
 * detected" unless the calldata proves the signer is paid on another network.
 */
export const ethereumEmptyReceiveOf = ({
    isTransfer,
    contractAction,
}: Pick<
    EthereumTransactionPresentation,
    'isTransfer' | 'contractAction'
>): EmptyReceiveSide => {
    if (isTransfer) return NOTHING
    if (contractAction?.kind === 'bridge') {
        return {
            kind: 'other-network',
            ...(contractAction.destinationName && {
                networkName: contractAction.destinationName,
            }),
        }
    }
    return NOT_DETECTED
}
