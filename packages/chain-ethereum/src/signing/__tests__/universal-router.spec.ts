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

import { describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    concat,
    decodeFunctionData,
    encodeAbiParameters,
    encodeFunctionData,
    parseAbi,
    parseAbiParameters,
    toHex,
} from 'viem'
import type { Address, Hex } from 'viem'
import {
    ETH_IN_THIRD_PARTY_RECIPIENT,
    ETH_IN_V2_EXACT_OUT_REFUND,
    ETH_IN_V3_EXACT_IN,
    BALANCE_CHECK_AFTER_EXACT_OUT,
    V2_EXACT_IN_PERMIT,
    V2_PERMIT_UNWRAP_SWEEP,
    V2_PORTION_UNWRAP,
    V3_EXACT_IN_PERMIT_SWEEP,
    V3_EXACT_IN_UNWRAP,
    V3_EXACT_OUT,
    V4_SWAP,
    type RecordedCall,
} from './contract-action-fixtures'
import { decodeUniversalRouterSwap } from '../universal-router'

const WETH: Address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const USDC: Address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const USDT: Address = '0xdAC17F958D2ee523a2206206994597C13D831ec7'

const decode = (call: RecordedCall) => decodeUniversalRouterSwap(call, WETH)

const dec = (value: bigint | string) => new Decimal(value.toString())

describe('decodeUniversalRouterSwap, recorded mainnet calls', () => {
    it('reads a V3 exact-in swap funded by a permit, paid to the signer and swept', () => {
        const action = decode(V3_EXACT_IN_PERMIT_SWEEP)

        expect(action).toEqual({
            kind: 'swap',
            input: {
                asset: {
                    kind: 'token',
                    contract: '0x8aD3c73F833d3F9A523aB01476625F269aEB7Cf0',
                },
                amount: dec(5538992293238688n),
                bound: 'exact',
            },
            output: {
                asset: { kind: 'token', contract: USDC },
                amount: dec(2267277n),
                bound: 'at-least',
            },
        })
    })

    it('reads a V2 exact-in swap', () => {
        const action = decode(V2_EXACT_IN_PERMIT)

        expect(action?.input).toEqual({
            asset: { kind: 'token', contract: WETH },
            amount: dec(400000000000000000n),
            bound: 'exact',
        })
        expect(action?.output).toEqual({
            asset: {
                kind: 'token',
                contract: '0x0fA42E54422dCFcBB939dF6ef52b6aE060e0Bbba',
            },
            amount: dec(169369508906497788290043330n),
            bound: 'at-least',
        })
    })

    it('reads a V3 exact-out swap from its reversed path', () => {
        const action = decode(V3_EXACT_OUT)

        expect(action?.input).toEqual({
            asset: { kind: 'token', contract: USDC },
            amount: dec(546816602n),
            bound: 'at-most',
        })
        expect(action?.output).toEqual({
            asset: {
                kind: 'token',
                contract: '0x972a7A92D92796a98801A8818bcF91f1648f2F68',
            },
            amount: dec(3500000000000n),
            bound: 'exact',
        })
    })

    it('reads ETH in from the call value when the swap spends the router balance', () => {
        const action = decode(ETH_IN_V3_EXACT_IN)

        expect(action?.input).toEqual({
            asset: { kind: 'native' },
            amount: dec(2n * 10n ** 18n),
            bound: 'exact',
        })
        expect(action?.output).toEqual({
            asset: {
                kind: 'token',
                contract: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
            },
            amount: dec(1602184057688809212n),
            bound: 'at-least',
        })
    })

    it('reads an ETH exact-out swap with its refund as at most the value', () => {
        const action = decode(ETH_IN_V2_EXACT_OUT_REFUND)

        expect(action?.input).toEqual({
            asset: { kind: 'native' },
            amount: dec(146659720967533418n),
            bound: 'at-most',
        })
        expect(action?.output).toEqual({
            asset: {
                kind: 'token',
                contract: '0x68BbEd6A47194EFf1CF514B50Ea91895597fc91E',
            },
            amount: dec(29000000000000000000000000n),
            bound: 'at-least',
        })
    })

    it('reads an unwrap to the signer as ETH out, with the unwrap minimum as the least', () => {
        const action = decode(V3_EXACT_IN_UNWRAP)

        expect(action?.input).toEqual({
            asset: { kind: 'token', contract: USDT },
            amount: dec(100000000n),
            bound: 'exact',
        })
        expect(action?.output).toEqual({
            asset: { kind: 'native' },
            amount: dec(43623847326204035n),
            bound: 'at-least',
        })
    })

    it('shows the minimum after a fee taken from the output token', () => {
        const action = decode(V2_PORTION_UNWRAP)

        expect(action?.output).toEqual({
            asset: { kind: 'native' },
            amount: dec(10135882799193251n),
            bound: 'at-least',
        })
    })

    it('reads a swap whose unwrap is followed by an ETH sweep', () => {
        const action = decode(V2_PERMIT_UNWRAP_SWEEP)

        expect(action?.output).toEqual({
            asset: { kind: 'native' },
            amount: dec(2141298218857898n),
            bound: 'at-least',
        })
    })

    it('gives nothing for a swap paying an address other than the signer', () => {
        expect(decode(ETH_IN_THIRD_PARTY_RECIPIENT)).toBeUndefined()
    })

    it.each([
        ['V4_SWAP', V4_SWAP],
        ['BALANCE_CHECK_ERC20', BALANCE_CHECK_AFTER_EXACT_OUT],
    ])('gives nothing for a command it does not know (%s)', (_name, call) => {
        expect(decode(call)).toBeUndefined()
    })
})

const EXECUTE_WITH_DEADLINE = parseAbi([
    'function execute(bytes commands, bytes[] inputs, uint256 deadline)',
])
const EXECUTE = parseAbi(['function execute(bytes commands, bytes[] inputs)'])

const rebuilt = (
    call: RecordedCall,
    change: (commands: number[], inputs: Hex[]) => void = () => {},
    { deadline }: { deadline?: bigint | null } = {},
): RecordedCall => {
    const { args } = decodeFunctionData({
        abi: EXECUTE_WITH_DEADLINE,
        data: call.data,
    })
    const commands = [...Buffer.from((args[0] as Hex).slice(2), 'hex')]
    const inputs = [...(args[1] as readonly Hex[])]
    change(commands, inputs)
    const encodedCommands = toHex(Uint8Array.from(commands))
    const data =
        deadline === null
            ? encodeFunctionData({
                  abi: EXECUTE,
                  functionName: 'execute',
                  args: [encodedCommands, inputs],
              })
            : encodeFunctionData({
                  abi: EXECUTE_WITH_DEADLINE,
                  functionName: 'execute',
                  args: [encodedCommands, inputs, deadline ?? args[2]],
              })
    return { ...call, data }
}

describe('decodeUniversalRouterSwap, the calldata must be exactly what it says', () => {
    const base = V3_EXACT_IN_PERMIT_SWEEP

    it('reads the overload without a deadline', () => {
        const call = rebuilt(base, undefined, { deadline: null })

        expect(call.data.startsWith('0x24856bc3')).toBe(true)
        expect(decode(call)).toEqual(decode(base))
    })

    it('reads past a short tag after the arguments, which execute ignores', () => {
        expect(decode({ ...base, data: `${base.data}756e6978` })).toEqual(
            decode(base),
        )
        expect(decode(V3_EXACT_OUT)).toBeDefined()
    })

    it('gives nothing for a long run of trailing bytes', () => {
        const long = `${base.data}${'00'.repeat(65)}`

        expect(decode({ ...base, data: long as Hex })).toBeUndefined()
    })

    it('gives nothing when a command input has dirty padding', () => {
        const call = rebuilt(base, (_commands, inputs) => {
            inputs[1] = `0x${'ff'}${inputs[1].slice(4)}`
        })

        expect(decode(call)).toBeUndefined()
    })

    it('gives nothing for a command that may fail silently', () => {
        const call = rebuilt(base, commands => {
            commands[1] |= 0x80
        })

        expect(decode(call)).toBeUndefined()
    })

    it('gives nothing when there are more inputs than commands', () => {
        const call = rebuilt(base, (_commands, inputs) => {
            inputs.push(inputs[0])
        })

        expect(decode(call)).toBeUndefined()
    })

    it('gives nothing for another selector', () => {
        expect(
            decode({ ...base, data: `0xdeadbeef${base.data.slice(10)}` }),
        ).toBeUndefined()
        expect(decode({ ...base, data: '0x' })).toBeUndefined()
    })

    it('gives nothing when the call carries ether and nothing wraps it', () => {
        expect(decode({ ...base, value: 1n })).toBeUndefined()
    })
})

const ROUTER: Address = '0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af'
const SIGNER: Address = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const OTHER: Address = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const TOKEN: Address = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const MSG_SENDER: Address = '0x0000000000000000000000000000000000000001'
const ADDRESS_THIS: Address = '0x0000000000000000000000000000000000000002'
const CONTRACT_BALANCE = 2n ** 255n

const V3 = parseAbiParameters(
    'address recipient, uint256 amount, uint256 limit, bytes path, bool payerIsUser',
)
const V2 = parseAbiParameters(
    'address recipient, uint256 amount, uint256 limit, address[] path, bool payerIsUser',
)
const PAIR = parseAbiParameters('address recipient, uint256 amount')
const TRIPLE = parseAbiParameters('address a, address b, uint256 c')
const PERMIT = parseAbiParameters(
    '((address token, uint160 amount, uint48 expiration, uint48 nonce) details, address spender, uint256 sigDeadline) permitSingle, bytes signature',
)

const V3_IN = 0x00
const V3_OUT = 0x01
const SWEEP = 0x04
const TRANSFER = 0x05
const PAY_PORTION = 0x06
const V2_IN = 0x08
const PERMIT2_PERMIT = 0x0a
const WRAP_ETH = 0x0b
const UNWRAP_WETH = 0x0c

const path3 = (...tokens: Address[]): Hex =>
    concat(
        tokens.flatMap((token, index) =>
            index === tokens.length - 1
                ? [token]
                : [token, toHex(3000, { size: 3 })],
        ),
    )

type Command = [type: number, input: Hex]

const v3 = (
    type: number,
    recipient: Address,
    amount: bigint,
    limit: bigint,
    path: Hex,
    payerIsUser: boolean,
): Command => [
    type,
    encodeAbiParameters(V3, [recipient, amount, limit, path, payerIsUser]),
]

const v2In = (
    recipient: Address,
    amount: bigint,
    limit: bigint,
    path: Address[],
    payerIsUser: boolean,
): Command => [
    V2_IN,
    encodeAbiParameters(V2, [recipient, amount, limit, path, payerIsUser]),
]

const pair = (type: number, recipient: Address, amount: bigint): Command => [
    type,
    encodeAbiParameters(PAIR, [recipient, amount]),
]

const triple = (type: number, a: Address, b: Address, c: bigint): Command => [
    type,
    encodeAbiParameters(TRIPLE, [a, b, c]),
]

const permit = (token: Address, spender: Address): Command => [
    PERMIT2_PERMIT,
    encodeAbiParameters(PERMIT, [
        [{ token, amount: 1n, expiration: 1, nonce: 0 }, spender, 1n],
        '0x1234',
    ]),
]

const call = (
    commands: Command[],
    { value = 0n, to = ROUTER }: { value?: bigint; to?: Address } = {},
): RecordedCall => ({
    from: SIGNER,
    to,
    value,
    data: encodeFunctionData({
        abi: EXECUTE_WITH_DEADLINE,
        functionName: 'execute',
        args: [
            toHex(Uint8Array.from(commands.map(([type]) => type))),
            commands.map(([, input]) => input),
            1n,
        ],
    }),
})

describe('decodeUniversalRouterSwap, rules', () => {
    const swapToSigner = v3(
        V3_IN,
        MSG_SENDER,
        1000n,
        900n,
        path3(USDC, USDT),
        true,
    )

    it('accepts the msg.sender alias for the signer', () => {
        expect(decode(call([swapToSigner]))?.output.amount).toEqual(dec(900n))
    })

    it('sums swaps split over one route', () => {
        const action = decode(
            call([
                swapToSigner,
                v3(V3_IN, SIGNER, 500n, 400n, path3(USDC, WETH, USDT), true),
            ]),
        )

        expect(action?.input.amount).toEqual(dec(1500n))
        expect(action?.output.amount).toEqual(dec(1300n))
    })

    it('gives nothing for swaps of different input tokens', () => {
        const action = decode(
            call([
                swapToSigner,
                v3(V3_IN, SIGNER, 500n, 400n, path3(TOKEN, USDT), true),
            ]),
        )

        expect(action).toBeUndefined()
    })

    it('gives nothing for swaps of different output tokens', () => {
        const action = decode(
            call([
                swapToSigner,
                v3(V3_IN, SIGNER, 500n, 400n, path3(USDC, TOKEN), true),
            ]),
        )

        expect(action).toBeUndefined()
    })

    it('gives nothing for exact-in and exact-out swaps together', () => {
        const action = decode(
            call([
                swapToSigner,
                v3(V3_OUT, SIGNER, 400n, 500n, path3(USDT, USDC), true),
            ]),
        )

        expect(action).toBeUndefined()
    })

    it('gives nothing for a swap of a token for itself', () => {
        const action = decode(
            call([v3(V3_IN, SIGNER, 1n, 1n, path3(USDC, USDC), true)]),
        )

        expect(action).toBeUndefined()
    })

    it('gives nothing for a malformed V3 path', () => {
        const action = decode(
            call([
                v3(V3_IN, SIGNER, 1n, 1n, concat([USDC, '0x000bb8']), true),
                v3(V3_IN, SIGNER, 1n, 1n, concat([USDC, '0x000b']), true),
            ]),
        )

        expect(action).toBeUndefined()
    })

    it('gives nothing for a V2 path of one token', () => {
        expect(
            decode(call([v2In(SIGNER, 1n, 1n, [USDC], true)])),
        ).toBeUndefined()
    })

    it('gives nothing for a swap paid to a third party', () => {
        const action = decode(
            call([v3(V3_IN, OTHER, 1000n, 900n, path3(USDC, USDT), true)]),
        )

        expect(action).toBeUndefined()
    })

    it('gives nothing when swaps are paid to the signer and the router', () => {
        const action = decode(
            call([
                v3(V3_IN, SIGNER, 1000n, 900n, path3(USDC, USDT), true),
                v3(V3_IN, ADDRESS_THIS, 1000n, 900n, path3(USDC, USDT), true),
                triple(SWEEP, USDT, SIGNER, 0n),
            ]),
        )

        expect(action).toBeUndefined()
    })

    it('gives nothing for a sweep or unwrap to a third party', () => {
        const toRouter = v3(
            V3_IN,
            ADDRESS_THIS,
            1000n,
            900n,
            path3(USDC, USDT),
            true,
        )

        expect(
            decode(call([toRouter, triple(SWEEP, USDT, OTHER, 900n)])),
        ).toBeUndefined()
        expect(
            decode(
                call([
                    v3(V3_IN, ADDRESS_THIS, 1000n, 0n, path3(USDC, WETH), true),
                    pair(UNWRAP_WETH, OTHER, 900n),
                ]),
            ),
        ).toBeUndefined()
    })

    it('gives nothing when the router holds the output and nothing sweeps it', () => {
        const action = decode(
            call([
                v3(V3_IN, ADDRESS_THIS, 1000n, 900n, path3(USDC, USDT), true),
            ]),
        )

        expect(action).toBeUndefined()
    })

    it('gives nothing when the output is both swept and unwrapped', () => {
        const action = decode(
            call([
                v3(V3_IN, ADDRESS_THIS, 1000n, 900n, path3(USDC, WETH), true),
                triple(SWEEP, WETH, SIGNER, 900n),
                pair(UNWRAP_WETH, SIGNER, 900n),
            ]),
        )

        expect(action).toBeUndefined()
    })

    it('shows wrapped ether out as a token when it is swept', () => {
        const action = decode(
            call([
                v3(V3_IN, ADDRESS_THIS, 1000n, 0n, path3(USDC, WETH), true),
                triple(SWEEP, WETH, SIGNER, 900n),
            ]),
        )

        expect(action?.output).toEqual({
            asset: { kind: 'token', contract: WETH },
            amount: dec(900n),
            bound: 'at-least',
        })
    })

    it('takes the larger of the swap minimum and the sweep minimum when no fee sits between', () => {
        const action = decode(
            call([
                v3(V3_IN, ADDRESS_THIS, 1000n, 900n, path3(USDC, USDT), true),
                triple(SWEEP, USDT, SIGNER, 0n),
            ]),
        )

        expect(action?.output.amount).toEqual(dec(900n))
    })

    it('uses only the sweep minimum once a fee comes out of the output', () => {
        const action = decode(
            call([
                v3(V3_IN, ADDRESS_THIS, 1000n, 900n, path3(USDC, USDT), true),
                triple(PAY_PORTION, USDT, OTHER, 100n),
                triple(SWEEP, USDT, SIGNER, 800n),
            ]),
        )

        expect(action?.output.amount).toEqual(dec(800n))
    })

    it('gives nothing for a fee in a token that is not the output', () => {
        const action = decode(
            call([
                v3(V3_IN, ADDRESS_THIS, 1000n, 900n, path3(USDC, USDT), true),
                triple(TRANSFER, USDC, OTHER, 100n),
                triple(SWEEP, USDT, SIGNER, 800n),
            ]),
        )

        expect(action).toBeUndefined()
    })

    it('gives nothing for a fee when the swap pays the signer directly', () => {
        const action = decode(
            call([swapToSigner, triple(PAY_PORTION, USDT, OTHER, 100n)]),
        )

        expect(action).toBeUndefined()
    })

    it('gives nothing when a sweep comes before the swap', () => {
        const action = decode(
            call([
                triple(SWEEP, USDT, SIGNER, 0n),
                v3(V3_IN, ADDRESS_THIS, 1000n, 900n, path3(USDC, USDT), true),
            ]),
        )

        expect(action).toBeUndefined()
    })

    it('gives nothing for an unwrap when nothing was wrapped and the output is not wrapped ether', () => {
        const action = decode(
            call([swapToSigner, pair(UNWRAP_WETH, SIGNER, 0n)]),
        )

        expect(action).toBeUndefined()
    })

    it('gives nothing when an amount the output depends on is the router balance', () => {
        expect(
            decode(
                call([
                    v3(
                        V3_IN,
                        SIGNER,
                        1000n,
                        CONTRACT_BALANCE,
                        path3(USDC, USDT),
                        true,
                    ),
                ]),
            ),
        ).toBeUndefined()
    })

    describe('token in', () => {
        it('gives nothing when the amount in is the router balance', () => {
            expect(
                decode(
                    call([
                        v3(
                            V3_IN,
                            SIGNER,
                            CONTRACT_BALANCE,
                            900n,
                            path3(USDC, USDT),
                            true,
                        ),
                    ]),
                ),
            ).toBeUndefined()
        })

        it('gives nothing when the router, not the user, pays', () => {
            expect(
                decode(
                    call([
                        v3(
                            V3_IN,
                            SIGNER,
                            1000n,
                            900n,
                            path3(USDC, USDT),
                            false,
                        ),
                    ]),
                ),
            ).toBeUndefined()
        })

        it('accepts a permit for the input token to the router', () => {
            const action = decode(call([permit(USDC, ROUTER), swapToSigner]))

            expect(action?.input.asset).toEqual({
                kind: 'token',
                contract: USDC,
            })
        })

        it('gives nothing for a permit to another spender', () => {
            expect(
                decode(call([permit(USDC, OTHER), swapToSigner])),
            ).toBeUndefined()
        })

        it('gives nothing for a permit of a token that is not paid in', () => {
            expect(
                decode(call([permit(TOKEN, ROUTER), swapToSigner])),
            ).toBeUndefined()
        })

        it('gives nothing for a permit after the swap', () => {
            expect(
                decode(call([swapToSigner, permit(USDC, ROUTER)])),
            ).toBeUndefined()
        })
    })

    describe('ether in', () => {
        const value = 10n ** 18n
        const wrap = pair(WRAP_ETH, ADDRESS_THIS, value)
        const swapFromBalance = v3(
            V3_IN,
            SIGNER,
            CONTRACT_BALANCE,
            900n,
            path3(WETH, USDT),
            false,
        )

        it('reads the call value as the amount in', () => {
            const action = decode(call([wrap, swapFromBalance], { value }))

            expect(action?.input).toEqual({
                asset: { kind: 'native' },
                amount: dec(value),
                bound: 'exact',
            })
        })

        it('accepts a wrap of the whole router balance', () => {
            const action = decode(
                call(
                    [
                        pair(WRAP_ETH, ADDRESS_THIS, CONTRACT_BALANCE),
                        swapFromBalance,
                    ],
                    {
                        value,
                    },
                ),
            )

            expect(action?.input.amount).toEqual(dec(value))
        })

        it('accepts swaps whose amounts add up to the value', () => {
            const action = decode(
                call(
                    [
                        wrap,
                        v3(
                            V3_IN,
                            SIGNER,
                            value / 4n,
                            1n,
                            path3(WETH, USDT),
                            false,
                        ),
                        v3(
                            V3_IN,
                            SIGNER,
                            (value * 3n) / 4n,
                            1n,
                            path3(WETH, USDT),
                            false,
                        ),
                    ],
                    { value },
                ),
            )

            expect(action?.input.amount).toEqual(dec(value))
        })

        it('gives nothing when the swaps spend only part of the wrapped ether and nothing is unwrapped', () => {
            const partial = v3(
                V3_IN,
                SIGNER,
                value / 2n,
                900n,
                path3(WETH, USDT),
                false,
            )

            expect(decode(call([wrap, partial], { value }))).toBeUndefined()
            expect(
                decode(
                    call([wrap, partial, pair(UNWRAP_WETH, SIGNER, 0n)], {
                        value,
                    }),
                )?.input.amount,
            ).toEqual(dec(value))
        })

        it('gives nothing when the wrap is less than the value', () => {
            expect(
                decode(
                    call(
                        [
                            pair(WRAP_ETH, ADDRESS_THIS, value / 2n),
                            swapFromBalance,
                        ],
                        {
                            value,
                        },
                    ),
                ),
            ).toBeUndefined()
        })

        it('gives nothing when the wrap pays someone other than the router', () => {
            expect(
                decode(
                    call([pair(WRAP_ETH, OTHER, value), swapFromBalance], {
                        value,
                    }),
                ),
            ).toBeUndefined()
        })

        it('gives nothing when the call carries no ether', () => {
            expect(decode(call([wrap, swapFromBalance]))).toBeUndefined()
        })

        it('gives nothing when the input token is not wrapped ether', () => {
            const notWeth = v3(
                V3_IN,
                SIGNER,
                CONTRACT_BALANCE,
                900n,
                path3(USDC, USDT),
                false,
            )

            expect(decode(call([wrap, notWeth], { value }))).toBeUndefined()
        })

        it('gives nothing when the chain has no known wrapped ether', () => {
            expect(
                decodeUniversalRouterSwap(
                    call([wrap, swapFromBalance], { value }),
                    undefined,
                ),
            ).toBeUndefined()
        })

        it('gives nothing when the user is the payer of a wrapped swap', () => {
            const paidByUser = v3(
                V3_IN,
                SIGNER,
                value,
                900n,
                path3(WETH, USDT),
                true,
            )

            expect(decode(call([wrap, paidByUser], { value }))).toBeUndefined()
        })

        it('gives nothing for a permit alongside a wrap', () => {
            expect(
                decode(
                    call([permit(WETH, ROUTER), wrap, swapFromBalance], {
                        value,
                    }),
                ),
            ).toBeUndefined()
        })

        it('gives nothing for exact-out without an unwrap of the unspent ether', () => {
            const exactOut = v3(
                V3_OUT,
                SIGNER,
                900n,
                value,
                path3(USDT, WETH),
                false,
            )

            expect(decode(call([wrap, exactOut], { value }))).toBeUndefined()
            expect(
                decode(
                    call([wrap, exactOut, pair(UNWRAP_WETH, SIGNER, 0n)], {
                        value,
                    }),
                )?.input,
            ).toEqual({
                asset: { kind: 'native' },
                amount: dec(value),
                bound: 'at-most',
            })
        })

        it('gives nothing for two wraps', () => {
            expect(
                decode(call([wrap, wrap, swapFromBalance], { value })),
            ).toBeUndefined()
        })
    })

    it('reads a V2 swap with the longest path ends', () => {
        const action = decode(
            call([v2In(SIGNER, 10n, 9n, [USDC, WETH, USDT], true)]),
        )

        expect(action?.input.asset).toEqual({ kind: 'token', contract: USDC })
        expect(action?.output.asset).toEqual({ kind: 'token', contract: USDT })
    })

    it('never throws on garbage', () => {
        expect(
            decodeUniversalRouterSwap(
                { from: SIGNER, to: ROUTER, value: 0n, data: '0x3593564c01' },
                WETH,
            ),
        ).toBeUndefined()
    })
})
