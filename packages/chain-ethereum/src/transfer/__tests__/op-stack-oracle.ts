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
    encodeFunctionResult,
    isAddressEqual,
    parseAbi,
    serializeTransaction,
    type Address,
    type Hex,
    type TransactionSerializableEIP1559,
} from 'viem'
import {
    EvmRpcErrorFixture,
    type EvmRpcResponder,
} from '../../blockchain/msw-handlers'

export const OP_STACK_ORACLE_ADDRESS: Address =
    '0x420000000000000000000000000000000000000F'

const oracleAbi = parseAbi([
    'function getL1Fee(bytes _data) view returns (uint256)',
    'function getOperatorFee(uint256 _gasUsed) view returns (uint256)',
])

const SIGNATURE_FIELDS: ReadonlySet<string> = new Set([
    'r',
    's',
    'v',
    'yParity',
])

export type OpStackOracleFixture = {
    /** The recorded `getL1Fee` answer per unsigned encoding. */
    l1Fees: ReadonlyMap<Hex, bigint>
    /** The `getOperatorFee` answer for any gas. */
    operatorFee: bigint
}

export type OpStackOracleCall =
    | { functionName: 'getL1Fee'; encoding: Hex }
    | { functionName: 'getOperatorFee'; gas: bigint }

/** The encoding the oracle prices: the signature is dropped, since the oracle adds its own size. */
export const unsignedEncodingOf = (
    transaction: TransactionSerializableEIP1559,
): Hex =>
    serializeTransaction({
        ...Object.fromEntries(
            Object.entries(transaction).filter(
                ([field]) => !SIGNATURE_FIELDS.has(field),
            ),
        ),
        type: 'eip1559',
    } as TransactionSerializableEIP1559)

/** Answers `getL1Fee` only for a recorded encoding and reverts otherwise, so a mispriced encoding fails loudly. */
export const opStackOracleResponder =
    (
        fixture: OpStackOracleFixture,
        calls: OpStackOracleCall[] = [],
    ): Extract<
        EvmRpcResponder<'eth_call'>,
        (params: readonly unknown[]) => unknown
    > =>
    params => {
        const { to, data } = params[0] as { to: Address; data: Hex }
        if (!isAddressEqual(to, OP_STACK_ORACLE_ADDRESS)) return '0x'
        const call = decodeFunctionData({ abi: oracleAbi, data })
        if (call.functionName === 'getOperatorFee') {
            calls.push({ functionName: 'getOperatorFee', gas: call.args[0] })
            return encodeFunctionResult({
                abi: oracleAbi,
                functionName: 'getOperatorFee',
                result: fixture.operatorFee,
            })
        }
        const encoding = call.args[0]
        calls.push({ functionName: 'getL1Fee', encoding })
        const fee = fixture.l1Fees.get(encoding)
        return fee === undefined
            ? new EvmRpcErrorFixture(3, 'execution reverted')
            : encodeFunctionResult({
                  abi: oracleAbi,
                  functionName: 'getL1Fee',
                  result: fee,
              })
    }
