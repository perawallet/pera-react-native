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

import {
    decodeFunctionData,
    encodeAbiParameters,
    encodeFunctionResult,
    isAddressEqual,
    parseAbi,
    zeroAddress,
    type Address,
    type Hex,
} from 'viem'
import { namehash } from 'viem/ens'
import { EvmRpcErrorFixture } from '../blockchain/msw-handlers'
import { ENS_UNIVERSAL_RESOLVER } from './verifyEnsAddress'

const universalResolverAbi = parseAbi([
    'function resolveWithGateways(bytes name, bytes data, string[] gateways) view returns (bytes, address)',
])
const addrAbi = parseAbi([
    'function addr(bytes32 node, uint256 coinType) view returns (bytes)',
])

/** One address record of an ENS name. `name` is normalised; `coinType` is ENSIP-9/11's. */
export type EnsRecordFixture = {
    name: string
    coinType: bigint
    address: Address
}

/**
 * `eth_call` answers for the Universal Resolver's `resolveWithGateways(…)`
 * read of an `addr(node, coinType)` record. A name or coin type left out
 * answers empty data, as a resolver with no such record does; a call to any
 * other target reverts.
 */
export const ensResolverCallResponder =
    (
        records: readonly EnsRecordFixture[],
    ): ((params: readonly unknown[]) => Hex | EvmRpcErrorFixture) =>
    params => {
        const { to, data } = params[0] as { to: Hex; data: Hex }
        if (!isAddressEqual(to, ENS_UNIVERSAL_RESOLVER)) {
            return new EvmRpcErrorFixture(3, 'execution reverted')
        }
        const {
            args: [, innerCall],
        } = decodeFunctionData({ abi: universalResolverAbi, data })
        const {
            args: [node, coinType],
        } = decodeFunctionData({ abi: addrAbi, data: innerCall })

        const record = records.find(
            candidate =>
                namehash(candidate.name) === node &&
                candidate.coinType === coinType,
        )
        const answer: Hex = record
            ? encodeAbiParameters([{ type: 'bytes' }], [record.address])
            : '0x'
        return encodeFunctionResult({
            abi: universalResolverAbi,
            functionName: 'resolveWithGateways',
            result: [answer, zeroAddress],
        })
    }
