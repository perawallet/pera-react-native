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
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { http } from 'msw'
import { setupServer } from 'msw/node'
import {
    decodeFunctionData,
    erc20Abi,
    getAddress,
    multicall3Abi,
    type Hex,
} from 'viem'
import type {
    ChainContext,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { AccountStateSnapshot } from '@perawallet/wallet-core-accounts'
import { logger } from '@perawallet/wallet-core-shared'
import { createEthereumAccountStateOps } from '../account-state'
import type { WhitelistItemResponse } from '../../assets/api/schema'
import {
    nativeWhitelistItem,
    unknownAssetItem,
} from '../../assets/api/msw-handlers'
import { peraEvmHandlers } from '../msw-handlers'
import {
    erc20CallResponder,
    EvmCallBurnsGas,
    EvmRpcErrorFixture,
    evmRpcHandlers,
    type Erc20Fixture,
    type EvmRpcResponder,
} from '../../blockchain/msw-handlers'
import { MULTICALL3_ADDRESS } from '../../blockchain/utils/erc20'
import {
    TEST_PERA_URL,
    TEST_RPC_URL,
    testChainContext,
} from '../../__tests__/context'
import { ETHEREUM } from '../../__tests__/evm-chains'

vi.mock('@perawallet/wallet-core-config', async importOriginal =>
    (await import('../../__tests__/pera-backend')).withEthereumPeraBackend(
        importOriginal,
        ['nfts'],
    ),
)

const storedHoldings = vi.hoisted(() => ({ ids: [] as string[] }))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    getAccountHeldAssets: vi.fn(async () =>
        storedHoldings.ids.map(assetId => ({ assetId, scope: SCOPE })),
    ),
}))

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ADDRESS: Hex = '0x00000000000000000000000000000000000000aa'
const HOLDER = getAddress(ADDRESS)
const OTHER_ADDRESS: Hex = '0x00000000000000000000000000000000000000bb'
const OTHER = getAddress(OTHER_ADDRESS)
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const FIRST_SYNC = { priorChainState: undefined }
const SYNCED = {
    priorChainState: {
        family: 'evm' as const,
        nonce: { latest: 0, pending: 0 },
    },
}
const PASS_INTERVAL_MS = 10 * 60_000
const PASS_RETRY_MS = 2 * 60_000

const listed = (address: string): WhitelistItemResponse => ({
    ...unknownAssetItem(`eip155:1/erc20:${address.toLowerCase()}`),
    type: 'erc20',
    fraction_decimals: 6,
    is_swappable: true,
    is_fundable: false,
})

const token = (balance: bigint): Erc20Fixture => ({
    name: 'Token',
    symbol: 'TKN',
    decimals: 6,
    totalSupply: 10n ** 12n,
    balances: { [HOLDER]: balance },
})

const holdsUsdcAndDai = erc20CallResponder({
    [USDC]: token(5n),
    [DAI]: token(7n),
})

// DAI's balance call burns the aggregate's gas, so a whole-list pass fails
// while a read of the held USDC alone answers.
const daiBurnsGas: EvmRpcResponder<'eth_call'> = params =>
    getAddress((params[0] as { to: Hex }).to) === DAI
        ? new EvmCallBurnsGas()
        : holdsUsdcAndDai(params)

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
    server.resetHandlers()
    storedHoldings.ids = []
})
afterAll(() => server.close())

const setup = ({
    ethCall = holdsUsdcAndDai,
    services = () => ['assets', 'blockFollowing'],
    transactionCount = () => '0x0',
}: {
    ethCall?: EvmRpcResponder<'eth_call'>
    services?: () => readonly string[]
    transactionCount?: EvmRpcResponder<'eth_getTransactionCount'>
} = {}) => {
    const clock = { now: 1_000_000 }
    server.use(
        ...evmRpcHandlers({
            rpcUrl: TEST_RPC_URL,
            responses: {
                eth_blockNumber: '0x64',
                eth_getBalance: '0x1',
                eth_call: ethCall,
                eth_getTransactionCount: transactionCount,
            },
        }),
        ...peraEvmHandlers({
            baseUrl: TEST_PERA_URL,
            whitelist: {
                1: [nativeWhitelistItem(1), listed(USDC), listed(DAI)],
            },
            blockFollowing: { refresh: false },
        }),
    )
    const ctx: ChainContext = {
        ...testChainContext(),
        getPeraBackend: () => ({
            baseUrl: TEST_PERA_URL,
            services: new Set(services()),
        }),
    }
    const ops = createEthereumAccountStateOps(ctx, ETHEREUM, {
        now: () => clock.now,
    })
    return { clock, ops }
}

// The token contracts the read's Multicall3 aggregates asked a balance of,
// with the account each was asked for.
const recordBalanceCalls = (): { target: string; owner: string }[] => {
    const calls: { target: string; owner: string }[] = []
    server.use(
        http.post(TEST_RPC_URL, async ({ request }) => {
            const body: unknown = await request.clone().json()
            for (const call of (Array.isArray(body) ? body : [body]) as {
                method: string
                params: [{ data: Hex }]
            }[]) {
                if (call.method !== 'eth_call') continue
                const { args } = decodeFunctionData({
                    abi: multicall3Abi,
                    data: call.params[0].data,
                })
                for (const { target, callData } of args[0] as {
                    target: Hex
                    callData: Hex
                }[]) {
                    if (getAddress(target) === MULTICALL3_ADDRESS) continue
                    const { args: balanceOf } = decodeFunctionData({
                        abi: erc20Abi,
                        data: callData,
                    })
                    calls.push({
                        target: getAddress(target),
                        owner: getAddress(balanceOf![0] as Hex),
                    })
                }
            }
            return undefined
        }),
    )
    return calls
}

const targetsOf = (calls: { target: string }[]) =>
    calls.map(call => call.target)

const heldIds = (state: AccountStateSnapshot) =>
    state.holdings.map(holding => holding.assetId)

describe('fetchAccountState passes over the whole token list', () => {
    it('reads only the held tokens when the whole list was read moments ago', async () => {
        storedHoldings.ids = [USDC]
        const { clock, ops } = setup()
        await ops.fetchAccountState(ADDRESS, SCOPE, FIRST_SYNC)
        clock.now += 10_000
        const calls = recordBalanceCalls()

        const state = await ops.fetchAccountState(ADDRESS, SCOPE, SYNCED)

        expect(targetsOf(calls)).toEqual([USDC])
        expect(heldIds(state)).toEqual(['native', USDC])
    })

    it('reads only the held tokens until ten minutes have passed', async () => {
        storedHoldings.ids = [USDC]
        const { clock, ops } = setup()
        await ops.fetchAccountState(ADDRESS, SCOPE, FIRST_SYNC)
        clock.now += PASS_INTERVAL_MS - 1
        const calls = recordBalanceCalls()

        await ops.fetchAccountState(ADDRESS, SCOPE, SYNCED)

        expect(targetsOf(calls)).toEqual([USDC])
    })

    it('reads the whole list again once ten minutes have passed', async () => {
        storedHoldings.ids = [USDC]
        const { clock, ops } = setup()
        await ops.fetchAccountState(ADDRESS, SCOPE, FIRST_SYNC)
        clock.now += PASS_INTERVAL_MS
        const calls = recordBalanceCalls()

        const state = await ops.fetchAccountState(ADDRESS, SCOPE, SYNCED)

        expect(targetsOf(calls)).toEqual(expect.arrayContaining([USDC, DAI]))
        expect(heldIds(state)).toEqual(['native', USDC, DAI])
    })

    it('reads the whole list on a first sync, however recently the account was read', async () => {
        const { clock, ops } = setup()
        await ops.fetchAccountState(ADDRESS, SCOPE, FIRST_SYNC)
        clock.now += 10_000

        const state = await ops.fetchAccountState(ADDRESS, SCOPE, FIRST_SYNC)

        expect(heldIds(state)).toEqual(['native', USDC, DAI])
    })

    it('reads the whole list only for the account that is due, not the others read with it', async () => {
        storedHoldings.ids = [USDC]
        const { clock, ops } = setup()
        await ops.fetchAccountState(ADDRESS, SCOPE, FIRST_SYNC)
        clock.now += 10_000
        const calls = recordBalanceCalls()

        await Promise.all([
            ops.fetchAccountState(ADDRESS, SCOPE, SYNCED),
            ops.fetchAccountState(OTHER_ADDRESS, SCOPE, FIRST_SYNC),
        ])

        const targetsFor = (owner: string) =>
            targetsOf(calls.filter(call => call.owner === owner))
        expect(targetsFor(HOLDER)).toEqual([USDC])
        expect(targetsFor(OTHER)).toEqual(expect.arrayContaining([USDC, DAI]))
    })

    it('reads the held tokens alone when the whole-list pass fails, rather than failing the read', async () => {
        storedHoldings.ids = [USDC]
        const { ops } = setup({ ethCall: daiBurnsGas })

        const state = await ops.fetchAccountState(ADDRESS, SCOPE, FIRST_SYNC)

        expect(heldIds(state)).toEqual(['native', USDC])
    })

    it('reports a change once a pass the account went without is due, and not after the pass', async () => {
        storedHoldings.ids = [USDC]
        const { clock, ops } = setup()
        await ops.fetchAccountState(ADDRESS, SCOPE, FIRST_SYNC)
        clock.now += 10_000
        await ops.fetchAccountState(ADDRESS, SCOPE, SYNCED)

        await expect(
            ops.fetchChangeSignal([ADDRESS], SCOPE, 100),
        ).resolves.toEqual({ changed: false, cursor: 100 })

        clock.now += PASS_INTERVAL_MS
        await expect(
            ops.fetchChangeSignal([ADDRESS], SCOPE, 100),
        ).resolves.toEqual({ changed: true, cursor: 100 })

        await ops.fetchAccountState(ADDRESS, SCOPE, SYNCED)
        await expect(
            ops.fetchChangeSignal([ADDRESS], SCOPE, 100),
        ).resolves.toEqual({ changed: false, cursor: 100 })
    })

    it('tries a whole-list pass that failed again two minutes later', async () => {
        storedHoldings.ids = [USDC]
        const { clock, ops } = setup({ ethCall: daiBurnsGas })
        await ops.fetchAccountState(ADDRESS, SCOPE, FIRST_SYNC)
        clock.now += PASS_RETRY_MS
        const calls = recordBalanceCalls()

        await ops.fetchAccountState(ADDRESS, SCOPE, SYNCED)

        expect(targetsOf(calls)).toEqual(expect.arrayContaining([USDC, DAI]))
    })

    it('still owes a pass whose read was rejected, and asks for it two minutes later', async () => {
        storedHoldings.ids = [USDC]
        const nonce = { fails: false }
        const { clock, ops } = setup({
            transactionCount: () =>
                nonce.fails
                    ? new EvmRpcErrorFixture(-32_000, 'node down')
                    : '0x0',
        })
        await ops.fetchAccountState(ADDRESS, SCOPE, FIRST_SYNC)
        clock.now += 10_000
        await ops.fetchAccountState(ADDRESS, SCOPE, SYNCED)
        clock.now += PASS_INTERVAL_MS
        nonce.fails = true
        await expect(
            ops.fetchAccountState(ADDRESS, SCOPE, SYNCED),
        ).rejects.toBeDefined()
        nonce.fails = false
        clock.now += PASS_RETRY_MS

        await expect(
            ops.fetchChangeSignal([ADDRESS], SCOPE, 100),
        ).resolves.toEqual({ changed: true, cursor: 100 })
    })

    it('reports a change once a failed whole-list pass is due again', async () => {
        storedHoldings.ids = [USDC]
        const { clock, ops } = setup({ ethCall: daiBurnsGas })
        await ops.fetchAccountState(ADDRESS, SCOPE, FIRST_SYNC)

        await expect(
            ops.fetchChangeSignal([ADDRESS], SCOPE, 100),
        ).resolves.toEqual({ changed: false, cursor: 100 })

        clock.now += PASS_INTERVAL_MS
        await expect(
            ops.fetchChangeSignal([ADDRESS], SCOPE, 100),
        ).resolves.toEqual({ changed: true, cursor: 100 })
    })

    it("retries a backfill account's failed whole-list pass only once it is due", async () => {
        storedHoldings.ids = [USDC]
        let services: readonly string[] = []
        const { clock, ops } = setup({
            ethCall: daiBurnsGas,
            services: () => services,
        })
        await ops.fetchAccountState(ADDRESS, SCOPE, FIRST_SYNC)
        services = ['assets', 'blockFollowing']
        await ops.fetchAccountState(ADDRESS, SCOPE, SYNCED)
        clock.now += 10_000
        const calls = recordBalanceCalls()

        await ops.fetchAccountState(ADDRESS, SCOPE, SYNCED)

        expect(targetsOf(calls)).toEqual([USDC])
    })

    it('stops reporting a change for a backfill account once a read with the list fell back', async () => {
        storedHoldings.ids = [USDC]
        let services: readonly string[] = []
        const { clock, ops } = setup({
            ethCall: daiBurnsGas,
            services: () => services,
        })
        await ops.fetchAccountState(ADDRESS, SCOPE, FIRST_SYNC)
        services = ['assets', 'blockFollowing']
        await ops.fetchAccountState(ADDRESS, SCOPE, SYNCED)
        clock.now += 10_000

        await expect(
            ops.fetchChangeSignal([ADDRESS], SCOPE, 100),
        ).resolves.toEqual({ changed: false, cursor: 100 })
    })

    it('reads the whole list as soon as it is back after a read went without it', async () => {
        storedHoldings.ids = [USDC]
        let services: readonly string[] = ['assets', 'blockFollowing']
        const { clock, ops } = setup({ services: () => services })
        await ops.fetchAccountState(ADDRESS, SCOPE, FIRST_SYNC)
        services = []
        clock.now += 10_000
        await ops.fetchAccountState(ADDRESS, SCOPE, SYNCED)
        services = ['assets', 'blockFollowing']
        clock.now += 10_000
        const calls = recordBalanceCalls()

        await ops.fetchAccountState(ADDRESS, SCOPE, SYNCED)

        expect(targetsOf(calls)).toEqual(expect.arrayContaining([USDC, DAI]))
    })

    it('logs a failed whole-list pass without the calldata it carried', async () => {
        storedHoldings.ids = [USDC]
        const warn = vi.spyOn(logger, 'warn')
        const { ops } = setup({ ethCall: daiBurnsGas })

        await ops.fetchAccountState(ADDRESS, SCOPE, FIRST_SYNC)

        const call = warn.mock.calls.find(([message]) =>
            message.startsWith('Token list balances unreadable'),
        )
        warn.mockRestore()
        expect(call).toBeDefined()
        expect(JSON.stringify(call)).not.toContain(DAI.slice(2).toLowerCase())
    })
})
