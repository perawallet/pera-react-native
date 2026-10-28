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
import { maxUint160 } from 'viem'
import type {
    ChainId,
    SpendApproval,
} from '@perawallet/wallet-core-chain-contract'
import type { EvmStandardCall } from './standard-call-types'

/**
 * Base units of a spend allowance, or undefined when it is unlimited. Permits
 * and transaction approvals both decide here, so the same grant reads the
 * same however it arrives. From 2^160 is unlimited: Permit2 caps amounts at
 * uint160, and no token supply comes near it.
 */
export const toAllowanceAmount = (baseUnits: bigint): Decimal | undefined =>
    baseUnits < maxUint160 ? new Decimal(baseUnits.toString()) : undefined

/**
 * The spend approval an `approve` or `increaseAllowance` grants. An on-chain
 * allowance lasts until revoked, so it has no deadline. Undefined for a
 * revocation (value 0) and for anything that isn't an allowance.
 */
export const spendApprovalOfCall = (
    call: EvmStandardCall,
    chainId: ChainId,
): SpendApproval | undefined => {
    if (
        (call.kind !== 'approve' && call.kind !== 'increase-allowance') ||
        call.value.isZero()
    ) {
        return undefined
    }
    const amount = toAllowanceAmount(BigInt(call.value.toFixed()))
    return {
        spender: call.spender,
        allowances: [
            {
                assetRef: { chainId, assetId: call.contract },
                ...(amount && { amount }),
            },
        ],
        isLongLived: true,
    }
}
