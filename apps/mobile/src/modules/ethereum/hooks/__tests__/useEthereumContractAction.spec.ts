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

import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSingleAssetDetailsQuery } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type {
    EthereumTransactionView,
    EvmContractAction,
    EvmContractLabel,
} from '@perawallet/wallet-core-chain-ethereum'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import { registerEthereumChain } from '@test-utils/chain-fixtures'
import { useEthereumContractAction } from '../useEthereumContractAction'

// The curated lookup is its own hook's to test; here only the bundled entry names a contract.
vi.mock('../useEthereumContractLabel', () => ({
    useEthereumContractLabel: (
        _scope: unknown,
        _address: unknown,
        bundled: unknown,
        isEnabled = true,
    ) => (isEnabled ? (bundled ?? null) : null),
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useChainCapability: vi.fn(),
}))

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const SIGNER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const ROUTER = '0x23617e59A5925b2A4Bf75d73ff6711cD0b29De85'
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const POOL = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'

const ROUTER_LABEL: EvmContractLabel = {
    kind: 'uniswap-universal-router',
    name: 'Uniswap Universal Router',
    projectDomain: 'uniswap.org',
}

const USDC_RECORD = { assetId: USDC, decimals: 6, unitName: 'USDC' }
const DAI_RECORD = { assetId: DAI, decimals: 18, unitName: 'DAI' }
const WETH_RECORD = { assetId: WETH, decimals: 18, unitName: 'WETH' }

type AssetQuery = ReturnType<typeof useSingleAssetDetailsQuery>

// Each id answers from `records`; one the map lacks has no record, like a
// lookup the node and the backend both fail.
const mockRecords = (
    records: Record<string, unknown>,
    pending: string[] = [],
) =>
    vi.mocked(useSingleAssetDetailsQuery).mockImplementation(
        (assetId: string) =>
            ({
                data: records[assetId],
                isPending: !assetId || pending.includes(assetId),
            }) as unknown as AssetQuery,
    )

const viewWith = (
    action: EvmContractAction | undefined,
    overrides: Partial<EthereumTransactionView> = {},
): EthereumTransactionView =>
    ({
        kind: 'contract-call',
        from: SIGNER,
        to: ROUTER,
        value: new Decimal(0),
        data: '0x',
        isPreview: true,
        knownContract: ROUTER_LABEL,
        ...(action && { action }),
        ...overrides,
    }) as EthereumTransactionView

const render = (view: EthereumTransactionView) =>
    renderHook(() => useEthereumContractAction(view, SCOPE)).result.current

type SwapAction = Extract<EvmContractAction, { kind: 'swap' }>

const swap = (
    input: SwapAction['input'],
    output: SwapAction['output'],
    fees: SwapAction['fees'] = [],
): EvmContractAction => ({ kind: 'swap', input, output, fees })

describe('useEthereumContractAction', () => {
    beforeAll(() => {
        registerEthereumChain()
    })

    beforeEach(() => {
        vi.mocked(useChainCapability).mockReturnValue(true)
        mockRecords({})
    })

    it('shows the legs of a token swap in display units once their tokens are known', () => {
        mockRecords({ [USDC]: USDC_RECORD, [DAI]: DAI_RECORD })

        const { contractAction, knownContract, isLoading } = render(
            viewWith(
                swap(
                    {
                        asset: { kind: 'token', contract: USDC },
                        amount: new Decimal(2_500_000),
                        bound: 'exact',
                    },
                    {
                        asset: { kind: 'token', contract: DAI },
                        amount: new Decimal(2n * 10n ** 18n + 5n * 10n ** 17n),
                        bound: 'at-least',
                    },
                ),
            ),
        )

        expect(contractAction).toEqual({
            kind: 'swap',
            input: {
                asset: USDC_RECORD,
                value: new Decimal(2.5),
                isBaseUnits: false,
                bound: 'exact',
            },
            output: {
                asset: DAI_RECORD,
                value: new Decimal(2.5),
                isBaseUnits: false,
                bound: 'at-least',
            },
            fees: [],
        })
        expect(knownContract).toEqual(ROUTER_LABEL)
        expect(isLoading).toBe(false)
    })

    it('shows base units, flagged as such, for a token it has no record of', () => {
        const { contractAction } = render(
            viewWith(
                swap(
                    {
                        asset: { kind: 'token', contract: USDC },
                        amount: new Decimal(2_500_000),
                        bound: 'exact',
                    },
                    {
                        asset: { kind: 'token', contract: DAI },
                        amount: new Decimal(7),
                        bound: 'at-least',
                    },
                ),
            ),
        )

        expect(contractAction).toMatchObject({
            input: {
                asset: null,
                value: new Decimal(2_500_000),
                isBaseUnits: true,
            },
            output: { asset: null, value: new Decimal(7), isBaseUnits: true },
        })
    })

    it('does not flag base units while a token record is still loading', () => {
        mockRecords({}, [USDC])

        const { contractAction } = render(
            viewWith(
                swap(
                    {
                        asset: { kind: 'token', contract: USDC },
                        amount: new Decimal(2_500_000),
                        bound: 'exact',
                    },
                    {
                        asset: { kind: 'native' },
                        amount: new Decimal(1),
                        bound: 'at-least',
                    },
                ),
            ),
        )

        expect(contractAction).toMatchObject({ input: { isBaseUnits: false } })
    })

    it('reads a native leg through the chain’s native asset, not a token record', () => {
        mockRecords({ [USDC]: USDC_RECORD })

        const { contractAction } = render(
            viewWith(
                swap(
                    {
                        asset: { kind: 'native' },
                        amount: new Decimal(10n ** 18n),
                        bound: 'exact',
                    },
                    {
                        asset: { kind: 'token', contract: USDC },
                        amount: new Decimal(1_000_000),
                        bound: 'at-least',
                    },
                ),
            ),
        )

        expect(contractAction).toMatchObject({
            input: {
                asset: expect.objectContaining({ unitName: 'ETH' }),
                value: new Decimal(1),
                isBaseUnits: false,
            },
            output: {
                asset: USDC_RECORD,
                value: new Decimal(1),
                isBaseUnits: false,
            },
        })
    })

    it('waits on a token record before the swap is settled', () => {
        mockRecords({}, [USDC])

        const { isLoading } = render(
            viewWith(
                swap(
                    {
                        asset: { kind: 'token', contract: USDC },
                        amount: new Decimal(1),
                        bound: 'exact',
                    },
                    {
                        asset: { kind: 'native' },
                        amount: new Decimal(1),
                        bound: 'at-least',
                    },
                ),
            ),
        )

        expect(isLoading).toBe(true)
    })

    it('presents a wrap in ether', () => {
        const { contractAction } = render(
            viewWith(
                { kind: 'wrap', amount: new Decimal(10n ** 18n) },
                { to: WETH },
            ),
        )

        expect(contractAction).toMatchObject({
            kind: 'wrap',
            amount: {
                asset: expect.objectContaining({ unitName: 'ETH' }),
                value: new Decimal(1),
            },
        })
    })

    it('presents an unwrap with the native asset’s decimals, never raw wei, even with no record of the wrapped token', () => {
        mockRecords({})

        const { contractAction } = render(
            viewWith(
                { kind: 'unwrap', amount: new Decimal(5n * 10n ** 17n) },
                { to: WETH },
            ),
        )

        expect(contractAction).toMatchObject({
            kind: 'unwrap',
            amount: {
                asset: expect.objectContaining({ unitName: 'ETH' }),
                value: new Decimal(0.5),
                isBaseUnits: false,
            },
        })
    })

    it('does not look the wrapped token up to present an unwrap', () => {
        mockRecords({ [WETH]: WETH_RECORD })
        vi.mocked(useSingleAssetDetailsQuery).mockClear()

        render(
            viewWith({ kind: 'unwrap', amount: new Decimal(1) }, { to: WETH }),
        )

        expect(useSingleAssetDetailsQuery).not.toHaveBeenCalledWith(
            WETH,
            expect.anything(),
        )
    })

    it('presents a lending action with its asset and amount', () => {
        mockRecords({ [USDC]: USDC_RECORD })

        const { contractAction } = render(
            viewWith(
                {
                    kind: 'supply',
                    asset: USDC,
                    amount: new Decimal(3_000_000),
                    isEntireBalance: false,
                },
                { to: POOL },
            ),
        )

        expect(contractAction).toEqual({
            kind: 'supply',
            assetContract: USDC,
            amount: {
                asset: USDC_RECORD,
                value: new Decimal(3),
                isBaseUnits: false,
            },
            isEntireBalance: false,
        })
    })

    it('flags a lending amount as base units when the asset has no record', () => {
        const { contractAction } = render(
            viewWith(
                {
                    kind: 'repay',
                    asset: USDC,
                    amount: new Decimal(3_000_000),
                    isEntireBalance: false,
                },
                { to: POOL },
            ),
        )

        expect(contractAction).toMatchObject({
            amount: {
                asset: null,
                value: new Decimal(3_000_000),
                isBaseUnits: true,
            },
        })
    })

    describe('a swap with fees', () => {
        const ATTACKER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
        const withFees = (fees: SwapAction['fees']) =>
            viewWith(
                swap(
                    {
                        asset: { kind: 'token', contract: USDC },
                        amount: new Decimal(1_000_000),
                        bound: 'exact',
                    },
                    {
                        asset: { kind: 'token', contract: DAI },
                        amount: new Decimal(1),
                        bound: 'at-least',
                    },
                    fees,
                ),
            )

        it('presents a portion fee as a percentage with its token and recipient', () => {
            const { contractAction } = render(
                withFees([
                    {
                        token: DAI,
                        recipient: ATTACKER,
                        size: { kind: 'bips', bips: 10_000 },
                    },
                    {
                        token: DAI,
                        recipient: SIGNER,
                        size: { kind: 'bips', bips: 25 },
                    },
                ]),
            )

            expect(contractAction).toMatchObject({
                fees: [
                    {
                        token: DAI,
                        recipient: ATTACKER,
                        size: { kind: 'percent', percent: new Decimal(100) },
                    },
                    {
                        recipient: SIGNER,
                        size: { kind: 'percent', percent: new Decimal(0.25) },
                    },
                ],
            })
        })

        it('presents an amount fee in display units once the fee token is known', () => {
            mockRecords({ [DAI]: DAI_RECORD })

            const { contractAction } = render(
                withFees([
                    {
                        token: DAI,
                        recipient: ATTACKER,
                        size: {
                            kind: 'amount',
                            amount: new Decimal(10n ** 18n),
                        },
                    },
                ]),
            )

            expect(contractAction).toMatchObject({
                fees: [
                    {
                        size: {
                            kind: 'amount',
                            amount: {
                                asset: DAI_RECORD,
                                value: new Decimal(1),
                                isBaseUnits: false,
                            },
                        },
                    },
                ],
            })
        })

        it('flags an amount fee as base units when the fee token has no record', () => {
            const { contractAction } = render(
                withFees([
                    {
                        token: DAI,
                        recipient: ATTACKER,
                        size: { kind: 'amount', amount: new Decimal(42) },
                    },
                ]),
            )

            expect(contractAction).toMatchObject({
                fees: [
                    {
                        size: {
                            kind: 'amount',
                            amount: {
                                asset: null,
                                value: new Decimal(42),
                                isBaseUnits: true,
                            },
                        },
                    },
                ],
            })
        })

        it('waits on the fee token record', () => {
            mockRecords({}, [DAI])

            const { isLoading } = render(
                withFees([
                    {
                        token: DAI,
                        recipient: ATTACKER,
                        size: { kind: 'amount', amount: new Decimal(1) },
                    },
                ]),
            )

            expect(isLoading).toBe(true)
        })
    })

    it('flags the whole balance of a withdrawal rather than showing the largest uint256', () => {
        mockRecords({ [USDC]: USDC_RECORD })

        const { contractAction } = render(
            viewWith(
                {
                    kind: 'withdraw',
                    asset: USDC,
                    amount: new Decimal(2).pow(256).minus(1),
                    isEntireBalance: true,
                },
                { to: POOL },
            ),
        )

        expect(contractAction).toMatchObject({
            kind: 'withdraw',
            isEntireBalance: true,
        })
    })

    it('labels a known contract whose call it cannot read', () => {
        const { contractAction, knownContract } = render(viewWith(undefined))

        expect(contractAction).toBeNull()
        expect(knownContract).toEqual(ROUTER_LABEL)
    })

    it('reads nothing while contractDecoding is off', () => {
        vi.mocked(useChainCapability).mockReturnValue(false)

        const result = render(
            viewWith({ kind: 'wrap', amount: new Decimal(1) }, { to: WETH }),
        )

        expect(result.contractAction).toBeNull()
        expect(result.knownContract).toBeNull()
        expect(useChainCapability).toHaveBeenCalledWith(
            'ethereum',
            'contractDecoding',
        )
    })

    it('reads nothing from a call that is a standard token call', () => {
        const result = render(
            viewWith(undefined, {
                call: {
                    kind: 'transfer',
                    contract: WETH,
                    from: SIGNER,
                    to: ROUTER,
                    value: new Decimal(1),
                },
            }),
        )

        expect(result.contractAction).toBeNull()
        expect(result.knownContract).toBeNull()
    })

    it('reads nothing with no view', () => {
        const { result } = renderHook(() =>
            useEthereumContractAction(null, SCOPE),
        )

        expect(result.current).toEqual({
            contractAction: null,
            knownContract: null,
            isLoading: false,
        })
    })
})
