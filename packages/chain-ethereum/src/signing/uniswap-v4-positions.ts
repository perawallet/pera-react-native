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
import { getAddress, parseAbi } from 'viem'
import type { Address, Hex } from 'viem'
import type { Optional } from '@perawallet/wallet-core-shared'
import { areEvmAddressesEqual } from '../accounts/address-codec'
import type { EvmActionAsset, EvmContractAction } from './contract-action-types'
import { readFunction } from './read-function'
import {
    isV4Caller,
    isV4Native,
    readV4Actions,
    type V4Action,
    type V4PoolKey,
} from './uniswap-v4'

type Call = { from: Address; to: Address; data: Hex; value: bigint }

const POOL_KEY_TUPLE =
    '(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks)'
const PERMIT_DETAILS =
    '(address token, uint160 amount, uint48 expiration, uint48 nonce)'

const MODIFY_LIQUIDITIES = parseAbi([
    'function modifyLiquidities(bytes unlockData, uint256 deadline)',
])

const MULTICALL = parseAbi(['function multicall(bytes[] data)'])

// What the Uniswap app batches ahead of the plan. The NFT's own `permit` is not
// here: it approves a spender for the position, which no review action shows.
const MULTICALL_ITEMS = parseAbi([
    'function modifyLiquidities(bytes unlockData, uint256 deadline)',
    `function initializePool(${POOL_KEY_TUPLE} key, uint160 sqrtPriceX96)`,
    `function permit(address owner, (${PERMIT_DETAILS} details, address spender, uint256 sigDeadline) permitSingle, bytes signature)`,
    `function permitBatch(address owner, (${PERMIT_DETAILS}[] details, address spender, uint256 sigDeadline) _permitBatch, bytes signature)`,
])

type PositionPlan = { actions: V4Action[]; initialized: Optional<V4PoolKey> }

const planOf = (call: Call): Optional<PositionPlan> => {
    const direct = readFunction(MODIFY_LIQUIDITIES, call.data)
    if (direct) {
        const actions = readV4Actions(direct.args[0] as Hex, undefined)
        return actions && { actions, initialized: undefined }
    }

    const multicall = readFunction(MULTICALL, call.data)
    if (!multicall) return undefined
    const items = (multicall.args[0] as readonly Hex[]).map(item =>
        readFunction(MULTICALL_ITEMS, item),
    )
    const last = items.at(-1)
    if (items.some(item => !item) || last?.name !== 'modifyLiquidities') {
        return undefined
    }
    const before = items.slice(0, -1) as NonNullable<(typeof items)[number]>[]
    // A second plan would run unread ahead of the one this reads.
    if (before.some(item => item.name === 'modifyLiquidities')) return undefined
    const pools = before.filter(item => item.name === 'initializePool')
    if (pools.length > 1) return undefined
    // A permit relays a Permit2 signature already given; one for another spender is no part of this.
    const isPermitForManager = before
        .filter(item => item.name === 'permit' || item.name === 'permitBatch')
        .every(item =>
            areEvmAddressesEqual(
                (item.args[1] as { spender: Address }).spender,
                call.to,
            ),
        )
    if (!isPermitForManager) return undefined

    const actions = readV4Actions(last.args[0] as Hex, undefined)
    return (
        actions && {
            actions,
            initialized: pools[0] && (pools[0].args[0] as V4PoolKey),
        }
    )
}

type PositionStep = Extract<
    V4Action,
    { kind: 'mint' | 'increase' | 'decrease' | 'burn' }
>

const isPositionStep = (action: V4Action): action is PositionStep =>
    action.kind === 'mint' ||
    action.kind === 'increase' ||
    action.kind === 'decrease' ||
    action.kind === 'burn'

// Every payout must reach the signer; anything the manager keeps can be swept by anyone.
const isSettlementForSigner = (action: V4Action, call: Call): boolean => {
    const isSigner = (recipient: Address) => isV4Caller(recipient, call.from)
    switch (action.kind) {
        case 'settle-pair':
        case 'close-currency': {
            return true
        }
        case 'settle': {
            // Settling a token from the manager's own balance spends whatever someone left there.
            return action.payerIsUser || isV4Native(action.currency)
        }
        case 'take':
        case 'take-pair':
        case 'sweep': {
            return isSigner(action.recipient)
        }
        default: {
            return false
        }
    }
}

const isSameKey = (a: V4PoolKey, b: V4PoolKey): boolean =>
    areEvmAddressesEqual(a.currency0, b.currency0) &&
    areEvmAddressesEqual(a.currency1, b.currency1) &&
    a.fee === b.fee &&
    a.tickSpacing === b.tickSpacing &&
    areEvmAddressesEqual(a.hooks, b.hooks)

const assetOf = (currency: Address): EvmActionAsset =>
    isV4Native(currency)
        ? { kind: 'native' }
        : { kind: 'token', contract: getAddress(currency) }

const toDecimal = (value: bigint): Decimal => new Decimal(value.toString())

const readAdd = (
    step: Extract<PositionStep, { kind: 'mint' | 'increase' }>,
    settlements: V4Action[],
    plan: PositionPlan,
    call: Call,
): Optional<EvmContractAction> => {
    // Ether the plan doesn't spend stays in the manager unless swept back last.
    const last = settlements.at(-1)
    const isNativeRefunded =
        last?.kind === 'sweep' &&
        isV4Native(last.currency) &&
        isV4Caller(last.recipient, call.from)
    if (call.value > 0n && !isNativeRefunded) return undefined

    if (step.kind === 'increase') {
        if (plan.initialized) return undefined
        return {
            kind: 'add-liquidity',
            deposits: [],
            position: { kind: 'existing', tokenId: step.tokenId.toString() },
        }
    }

    const { poolKey, owner, amount0Max, amount1Max } = step
    if (!isV4Caller(owner, call.from)) return undefined
    if (areEvmAddressesEqual(poolKey.currency0, poolKey.currency1)) {
        return undefined
    }
    if (plan.initialized && !isSameKey(plan.initialized, poolKey)) {
        return undefined
    }
    // Native sorts first, so only currency0 can be it; without value the
    // manager would pay it from ether someone else left there.
    const isNativePair = isV4Native(poolKey.currency0)
    if (isNativePair !== call.value > 0n) return undefined
    if (isNativePair && amount0Max > call.value) return undefined

    return {
        kind: 'add-liquidity',
        deposits: [
            {
                asset: assetOf(poolKey.currency0),
                maxAmount: toDecimal(amount0Max),
            },
            {
                asset: assetOf(poolKey.currency1),
                maxAmount: toDecimal(amount1Max),
            },
        ],
        position: { kind: 'new' },
    }
}

const readRemove = (
    steps: PositionStep[],
    settlements: V4Action[],
    plan: PositionPlan,
    call: Call,
): Optional<EvmContractAction> => {
    if (call.value !== 0n || plan.initialized) return undefined
    // A removal only takes: a settle or sweep here would pay in, or pay out what the plan didn't produce.
    const isPayoutOnly = settlements.every(
        action =>
            action.kind === 'take' ||
            action.kind === 'take-pair' ||
            action.kind === 'close-currency',
    )
    if (!isPayoutOnly) return undefined

    const [first, second] = steps
    if (steps.length === 2) {
        if (first.kind !== 'decrease' || second.kind !== 'burn')
            return undefined
        if (first.tokenId !== second.tokenId) return undefined
        return {
            kind: 'remove-liquidity',
            tokenId: first.tokenId.toString(),
            isClosing: true,
        }
    }
    if (first.kind === 'burn') {
        return {
            kind: 'remove-liquidity',
            tokenId: first.tokenId.toString(),
            isClosing: true,
        }
    }
    if (first.kind !== 'decrease') return undefined
    // Any change to a position credits its fees, so removing no liquidity only collects them.
    return first.liquidity === 0n
        ? { kind: 'collect-fees', tokenId: first.tokenId.toString() }
        : {
              kind: 'remove-liquidity',
              tokenId: first.tokenId.toString(),
              isClosing: false,
          }
}

/**
 * What a call to the V4 PositionManager does, or undefined unless the plan
 * changes one position, every payout reaches the signer and nothing else runs.
 * Never throws.
 */
export const decodeUniswapV4PositionAction = (
    call: Call,
): Optional<EvmContractAction> => {
    try {
        const plan = planOf(call)
        if (!plan) return undefined
        const steps = plan.actions.filter(isPositionStep)
        // Position changes come first: a settlement ahead of them would pay for nothing yet owed.
        const settlements = plan.actions.slice(steps.length)
        if (steps.length === 0 || steps.length > 2) return undefined
        if (settlements.some(isPositionStep)) return undefined
        if (!settlements.every(action => isSettlementForSigner(action, call))) {
            return undefined
        }
        const [step] = steps
        if (step.kind === 'mint' || step.kind === 'increase') {
            return steps.length === 1
                ? readAdd(step, settlements, plan, call)
                : undefined
        }
        return readRemove(steps, settlements, plan, call)
    } catch {
        return undefined
    }
}
