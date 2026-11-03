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
import {
    decodeAbiParameters,
    decodeFunctionData,
    encodeAbiParameters,
    encodeFunctionData,
    getAddress,
    hexToBytes,
    parseAbi,
    parseAbiParameters,
    size,
    slice,
    toFunctionSelector,
} from 'viem'
import type { AbiFunction, AbiParameter, Address, Hex } from 'viem'
import type { Optional } from '@perawallet/wallet-core-shared'
import { areEvmAddressesEqual } from '../accounts/address-codec'
import type {
    EvmContractAction,
    EvmSwapFee,
    EvmSwapLeg,
} from './contract-action-types'

type SwapAction = Extract<EvmContractAction, { kind: 'swap' }>

type Call = { from: Address; to: Address; data: Hex; value: bigint }

const SELECTOR_SIZE = 4

// `execute` ignores anything after its arguments, and the Uniswap app appends
// a short attribution tag there; only the bytes up to it are the call.
const MAX_TRAILING_BYTES = 64

const EXECUTE_FUNCTIONS = parseAbi([
    'function execute(bytes commands, bytes[] inputs, uint256 deadline)',
    'function execute(bytes commands, bytes[] inputs)',
])

const BY_SELECTOR = new Map<Hex, AbiFunction>(
    EXECUTE_FUNCTIONS.map(item => [toFunctionSelector(item), item]),
)

// Aliases the router resolves itself: the caller, and the router.
const MSG_SENDER: Address = '0x0000000000000000000000000000000000000001'
const ADDRESS_THIS: Address = '0x0000000000000000000000000000000000000002'

// "Whatever the router holds": an amount the calldata doesn't fix.
const CONTRACT_BALANCE = 2n ** 255n

// The low six bits are the command; the top bit lets it fail without reverting.
const COMMAND_TYPE_MASK = 0x3f
const COMMAND_FLAG_BITS = 0xc0

const V3_SWAP_EXACT_IN = 0x00
const V3_SWAP_EXACT_OUT = 0x01
const SWEEP = 0x04
const TRANSFER = 0x05
const PAY_PORTION = 0x06
const V2_SWAP_EXACT_IN = 0x08
const V2_SWAP_EXACT_OUT = 0x09
const PERMIT2_PERMIT = 0x0a
const WRAP_ETH = 0x0b
const UNWRAP_WETH = 0x0c

// The router reverts a portion outside 1..10 000.
const MAX_PORTION_BIPS = 10_000n

// Routers from V2.1 add a per-hop minimum price to each swap; it can only make
// the swap revert, so it is read past rather than shown. Older routers don't have it.
const V3_SWAP_INPUTS = [
    parseAbiParameters(
        'address recipient, uint256 amount, uint256 limit, bytes path, bool payerIsUser',
    ),
    parseAbiParameters(
        'address recipient, uint256 amount, uint256 limit, bytes path, bool payerIsUser, uint256[] minHopPriceX36',
    ),
]
const V2_SWAP_INPUTS = [
    parseAbiParameters(
        'address recipient, uint256 amount, uint256 limit, address[] path, bool payerIsUser',
    ),
    parseAbiParameters(
        'address recipient, uint256 amount, uint256 limit, address[] path, bool payerIsUser, uint256[] minHopPriceX36',
    ),
]
const WRAP_INPUT = parseAbiParameters('address recipient, uint256 amountMin')
const TOKEN_PAYOUT_INPUT = parseAbiParameters(
    'address token, address recipient, uint256 amount',
)
const PERMIT_INPUT = parseAbiParameters(
    '((address token, uint160 amount, uint48 expiration, uint48 nonce) details, address spender, uint256 sigDeadline) permitSingle, bytes signature',
)

const ADDRESS_SIZE = 20
const V3_FEE_SIZE = 3
const V3_HOP_SIZE = ADDRESS_SIZE + V3_FEE_SIZE

type SwapStep = {
    kind: 'swap'
    isExactIn: boolean
    recipient: Address
    /** The amount in for exact-in; the amount out for exact-out. */
    amount: bigint
    /** The minimum out for exact-in; the maximum in for exact-out. */
    limit: bigint
    tokenIn: Address
    tokenOut: Address
    payerIsUser: boolean
}

type PermitStep = { kind: 'permit'; token: Address; spender: Address }
type WrapStep = { kind: 'wrap'; recipient: Address; amount: bigint }
type FeeStep = {
    kind: 'fee'
    token: Address
    recipient: Address
    size: EvmSwapFee['size']
}
type SweepStep = {
    kind: 'sweep'
    token: Address
    recipient: Address
    amountMin: bigint
}
type UnwrapStep = { kind: 'unwrap'; recipient: Address; amountMin: bigint }

type Step = PermitStep | WrapStep | SwapStep | FeeStep | SweepStep | UnwrapStep

// The order a router run must keep for each step to mean what it says: a sweep
// before the swap would sweep nothing and leave the output in the router.
const STAGE_OF: Record<Step['kind'], number> = {
    permit: 0,
    wrap: 1,
    swap: 2,
    fee: 3,
    sweep: 4,
    unwrap: 4,
}

const decodeInput = (
    parameters: readonly AbiParameter[],
    input: Hex,
): Optional<readonly unknown[]> => {
    const values = decodeAbiParameters(parameters, input)
    const encoded = encodeAbiParameters(parameters, values)
    return encoded.toLowerCase() === input.toLowerCase() ? values : undefined
}

// The first layout the input re-encodes to exactly; a layout it doesn't fit can throw.
const decodeInputAs = (
    layouts: readonly (readonly AbiParameter[])[],
    input: Hex,
): Optional<readonly unknown[]> => {
    for (const layout of layouts) {
        try {
            const values = decodeInput(layout, input)
            if (values) return values
        } catch {
            continue
        }
    }
    return undefined
}

const addressOf = (value: unknown): Address => getAddress(value as Address)

type PathEnds = { first: Address; last: Address }

const v3PathEnds = (path: Hex): Optional<PathEnds> => {
    const length = size(path)
    if (
        length < ADDRESS_SIZE + V3_HOP_SIZE ||
        (length - ADDRESS_SIZE) % V3_HOP_SIZE !== 0
    ) {
        return undefined
    }
    return {
        first: getAddress(slice(path, 0, ADDRESS_SIZE)),
        last: getAddress(slice(path, length - ADDRESS_SIZE, length)),
    }
}

const v2PathEnds = (path: readonly Address[]): Optional<PathEnds> =>
    path.length >= 2
        ? { first: getAddress(path[0]), last: getAddress(path.at(-1)!) }
        : undefined

const swapStep = (type: number, input: Hex): Optional<SwapStep> => {
    const isV3 = type === V3_SWAP_EXACT_IN || type === V3_SWAP_EXACT_OUT
    const isExactIn = type === V3_SWAP_EXACT_IN || type === V2_SWAP_EXACT_IN
    const values = decodeInputAs(isV3 ? V3_SWAP_INPUTS : V2_SWAP_INPUTS, input)
    if (!values) return undefined
    const [recipient, amount, limit, path, payerIsUser] = values as [
        Address,
        bigint,
        bigint,
        Hex | readonly Address[],
        boolean,
    ]
    const ends = isV3
        ? v3PathEnds(path as Hex)
        : v2PathEnds(path as readonly Address[])
    if (!ends) return undefined
    // A V3 exact-out path runs from the token out back to the token in; every other path runs forward.
    const isReversed = isV3 && !isExactIn
    return {
        kind: 'swap',
        isExactIn,
        recipient: addressOf(recipient),
        amount,
        limit,
        tokenIn: isReversed ? ends.last : ends.first,
        tokenOut: isReversed ? ends.first : ends.last,
        payerIsUser,
    }
}

const stepOf = (commandByte: number, input: Hex): Optional<Step> => {
    if ((commandByte & COMMAND_FLAG_BITS) !== 0) return undefined
    const type = commandByte & COMMAND_TYPE_MASK
    switch (type) {
        case V3_SWAP_EXACT_IN:
        case V3_SWAP_EXACT_OUT:
        case V2_SWAP_EXACT_IN:
        case V2_SWAP_EXACT_OUT: {
            return swapStep(type, input)
        }
        case WRAP_ETH: {
            const values = decodeInput(WRAP_INPUT, input)
            return (
                values && {
                    kind: 'wrap',
                    recipient: addressOf(values[0]),
                    amount: values[1] as bigint,
                }
            )
        }
        case UNWRAP_WETH: {
            const values = decodeInput(WRAP_INPUT, input)
            return (
                values && {
                    kind: 'unwrap',
                    recipient: addressOf(values[0]),
                    amountMin: values[1] as bigint,
                }
            )
        }
        case SWEEP: {
            const values = decodeInput(TOKEN_PAYOUT_INPUT, input)
            return (
                values && {
                    kind: 'sweep',
                    token: addressOf(values[0]),
                    recipient: addressOf(values[1]),
                    amountMin: values[2] as bigint,
                }
            )
        }
        case TRANSFER:
        case PAY_PORTION: {
            const values = decodeInput(TOKEN_PAYOUT_INPUT, input)
            if (!values) return undefined
            const value = values[2] as bigint
            const isPortion = type === PAY_PORTION
            // A transfer of the router balance is a fee the calldata doesn't size.
            if (
                isPortion
                    ? value === 0n || value > MAX_PORTION_BIPS
                    : value === CONTRACT_BALANCE
            ) {
                return undefined
            }
            return {
                kind: 'fee',
                token: addressOf(values[0]),
                recipient: addressOf(values[1]),
                size: isPortion
                    ? { kind: 'bips', bips: Number(value) }
                    : { kind: 'amount', amount: new Decimal(value.toString()) },
            }
        }
        case PERMIT2_PERMIT: {
            const values = decodeInput(PERMIT_INPUT, input)
            if (!values) return undefined
            const permit = values[0] as {
                details: { token: Address }
                spender: Address
            }
            return {
                kind: 'permit',
                token: getAddress(permit.details.token),
                spender: getAddress(permit.spender),
            }
        }
        default: {
            return undefined
        }
    }
}

const readExecute = (
    data: Hex,
): Optional<{ commands: Hex; inputs: readonly Hex[] }> => {
    if (size(data) < SELECTOR_SIZE) return undefined
    const item = BY_SELECTOR.get(
        slice(data, 0, SELECTOR_SIZE).toLowerCase() as Hex,
    )
    if (!item) return undefined
    const { args = [] } = decodeFunctionData({ abi: [item], data })
    const encoded = encodeFunctionData({ abi: [item], args })
    const isEncodedPrefix = data.toLowerCase().startsWith(encoded.toLowerCase())
    const trailingBytes = size(data) - size(encoded)
    if (!isEncodedPrefix || trailingBytes > MAX_TRAILING_BYTES) return undefined
    return { commands: args[0] as Hex, inputs: args[1] as readonly Hex[] }
}

const readSteps = (data: Hex): Optional<Step[]> => {
    const execute = readExecute(data)
    if (!execute) return undefined
    const commands = hexToBytes(execute.commands)
    if (commands.length === 0 || commands.length !== execute.inputs.length) {
        return undefined
    }
    const steps: Step[] = []
    for (const [index, commandByte] of commands.entries()) {
        const step = stepOf(commandByte, execute.inputs[index])
        const previous = steps.at(-1)
        if (
            !step ||
            (previous && STAGE_OF[step.kind] < STAGE_OF[previous.kind])
        ) {
            return undefined
        }
        steps.push(step)
    }
    return steps
}

const sum = (values: readonly bigint[]): bigint =>
    values.reduce((total, value) => total + value, 0n)

const toLeg = (
    asset: EvmSwapLeg['asset'],
    amount: bigint,
    bound: EvmSwapLeg['bound'],
): EvmSwapLeg => ({
    asset,
    amount: new Decimal(amount.toString()),
    bound,
})

type Steps = {
    permits: PermitStep[]
    wraps: WrapStep[]
    swaps: SwapStep[]
    fees: FeeStep[]
    sweeps: SweepStep[]
    unwraps: UnwrapStep[]
}

const group = (steps: readonly Step[]): Steps => ({
    permits: steps.filter(step => step.kind === 'permit'),
    wraps: steps.filter(step => step.kind === 'wrap'),
    swaps: steps.filter(step => step.kind === 'swap'),
    fees: steps.filter(step => step.kind === 'fee'),
    sweeps: steps.filter(step => step.kind === 'sweep'),
    unwraps: steps.filter(step => step.kind === 'unwrap'),
})

type Context = {
    call: Call
    wrappedNative: Optional<Address>
    isSigner: (address: Address) => boolean
    isRouter: (address: Address) => boolean
}

// What the user pays: the ether the call carries, or the token the swaps pull in.
const readInput = (
    { call, wrappedNative, isRouter }: Context,
    { permits, wraps, swaps, unwraps }: Steps,
): Optional<EvmSwapLeg> => {
    const { isExactIn, tokenIn } = swaps[0]
    const bound = isExactIn ? 'exact' : 'at-most'
    const inAmounts = swaps.map(swap => (isExactIn ? swap.amount : swap.limit))
    const [wrap] = wraps

    if (!wrap) {
        const isPermitted = permits.every(
            permit =>
                areEvmAddressesEqual(permit.spender, call.to) &&
                areEvmAddressesEqual(permit.token, tokenIn),
        )
        if (
            call.value !== 0n ||
            !isPermitted ||
            inAmounts.includes(CONTRACT_BALANCE) ||
            swaps.some(swap => !swap.payerIsUser)
        ) {
            return undefined
        }
        return toLeg(
            { kind: 'token', contract: tokenIn },
            sum(inAmounts),
            bound,
        )
    }

    // Ether in: the router wraps what the call carries and swaps from its own balance.
    const wrapsAllValue =
        wrap.amount === call.value || wrap.amount === CONTRACT_BALANCE
    if (
        call.value <= 0n ||
        !wrapsAllValue ||
        !isRouter(wrap.recipient) ||
        !wrappedNative ||
        !areEvmAddressesEqual(tokenIn, wrappedNative) ||
        permits.length > 0 ||
        swaps.some(swap => swap.payerIsUser)
    ) {
        return undefined
    }
    // Wrapped ether the swaps don't spend must be unwrapped back to the user.
    const spendsAll =
        isExactIn &&
        ((inAmounts.length === 1 && inAmounts[0] === CONTRACT_BALANCE) ||
            (!inAmounts.includes(CONTRACT_BALANCE) &&
                sum(inAmounts) === call.value))
    if (!spendsAll && unwraps.length === 0) return undefined
    return toLeg({ kind: 'native' }, call.value, bound)
}

// What the user is paid, and the least of it the calldata guarantees.
const readOutput = (
    { wrappedNative, isSigner, isRouter }: Context,
    { wraps, swaps, fees, sweeps, unwraps }: Steps,
): Optional<EvmSwapLeg> => {
    const { isExactIn, tokenOut } = swaps[0]
    const outAmounts = swaps.map(swap => (isExactIn ? swap.limit : swap.amount))
    const tokenAsset = { kind: 'token', contract: tokenOut } as const
    const isPaidToSigner = swaps.every(swap => isSigner(swap.recipient))
    const isPaidToRouter = swaps.every(swap => isRouter(swap.recipient))
    if (outAmounts.includes(CONTRACT_BALANCE)) return undefined
    if (
        sweeps.some(sweep => !isSigner(sweep.recipient)) ||
        unwraps.some(unwrap => !isSigner(unwrap.recipient))
    ) {
        return undefined
    }

    if (isPaidToSigner) {
        // An unwrap here can only hand back ether the wrap was not fully spent from.
        if (fees.length > 0 || (unwraps.length > 0 && wraps.length === 0)) {
            return undefined
        }
        return toLeg(
            tokenAsset,
            sum(outAmounts),
            isExactIn ? 'at-least' : 'exact',
        )
    }
    if (!isPaidToRouter) return undefined

    // A fee comes out of the token the user is paid in, before they are.
    if (fees.some(fee => !areEvmAddressesEqual(fee.token, tokenOut))) {
        return undefined
    }
    const isWrappedOutput =
        !!wrappedNative && areEvmAddressesEqual(tokenOut, wrappedNative)
    const outputSweeps = sweeps.filter(sweep =>
        areEvmAddressesEqual(sweep.token, tokenOut),
    )
    let paid: Optional<{ asset: EvmSwapLeg['asset']; min: bigint }>
    if (isWrappedOutput && unwraps.length === 1 && outputSweeps.length === 0) {
        paid = { asset: { kind: 'native' }, min: unwraps[0].amountMin }
    } else if (
        outputSweeps.length === 1 &&
        (unwraps.length === 0 || wraps.length > 0)
    ) {
        paid = { asset: tokenAsset, min: outputSweeps[0].amountMin }
    }
    if (!paid) return undefined

    // With no fee between the swap and the user, the swap's own minimum binds too.
    const swapMin = fees.length === 0 ? sum(outAmounts) : 0n
    return toLeg(
        paid.asset,
        paid.min > swapMin ? paid.min : swapMin,
        'at-least',
    )
}

// The router's own aliases would read as meaningless addresses.
const resolveAlias = (address: Address, call: Call): Address => {
    if (address === MSG_SENDER) return getAddress(call.from)
    return address === ADDRESS_THIS ? getAddress(call.to) : address
}

const readSwap = (
    call: Call,
    wrappedNative: Optional<Address>,
): Optional<SwapAction> => {
    const steps = readSteps(call.data)
    if (!steps) return undefined
    const grouped = group(steps)
    const { swaps, wraps } = grouped
    if (swaps.length === 0 || wraps.length > 1) return undefined

    const [{ isExactIn, tokenIn, tokenOut }] = swaps
    const isOneRoute = swaps.every(
        swap =>
            swap.isExactIn === isExactIn &&
            areEvmAddressesEqual(swap.tokenIn, tokenIn) &&
            areEvmAddressesEqual(swap.tokenOut, tokenOut),
    )
    if (!isOneRoute || areEvmAddressesEqual(tokenIn, tokenOut)) {
        return undefined
    }

    const context: Context = {
        call,
        wrappedNative,
        isSigner: address =>
            address === MSG_SENDER || areEvmAddressesEqual(address, call.from),
        isRouter: address =>
            address === ADDRESS_THIS || areEvmAddressesEqual(address, call.to),
    }
    const input = readInput(context, grouped)
    const output = input && readOutput(context, grouped)
    if (!input || !output) return undefined
    const fees = grouped.fees.map(({ token, recipient, size }): EvmSwapFee => ({
        token,
        recipient: resolveAlias(recipient, call),
        size,
    }))
    return { kind: 'swap', input, output, fees }
}

/**
 * The swap a Universal Router `execute` makes, or undefined unless the calldata
 * fully accounts for the call: every command is a known one that re-encodes
 * byte for byte, the output reaches only the signer (less any fee in the
 * output token, which the action carries), and the swaps agree on one route. Anything doubtful is no swap, so a
 * review never calls "Swap" a call that does more. Never throws.
 */
export const decodeUniversalRouterSwap = (
    call: Call,
    wrappedNative: Optional<Address>,
): Optional<SwapAction> => {
    try {
        return readSwap(call, wrappedNative)
    } catch {
        return undefined
    }
}
