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

import { vi } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { cardContractTests } from '@perawallet/wallet-core-card/testing'

const { getAlgorandClient, submit, submitWithFeeDelegation } = vi.hoisted(
    () => ({
        getAlgorandClient: vi.fn(),
        submit: vi.fn(async () => ({ txIds: [] })),
        submitWithFeeDelegation: vi.fn(async () => undefined),
    }),
)
vi.mock('../../blockchain', async () => ({
    ...(await vi.importActual<object>('../../blockchain')),
    getAlgorandClient,
}))
// A deployed switch contract; the delegation leg before the on-chain check is
// covered in useAlgorandCardAutoDraw.spec.
vi.mock('../config', async () => ({
    algorandCardConfig: () => ({
        mainAppId: '111',
        killswitchAppId: '222',
        autoDrawProgramHash: '',
        usdcAssetId: '10458941',
    }),
}))
vi.mock('../escrow/lsig', async () => ({
    ...(await vi.importActual<object>('../escrow/lsig')),
    compileAutoDrawProgram: async () => new Uint8Array([6, 129, 1]),
}))
vi.mock('@perawallet/wallet-core-card', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-card')),
    postCardDelegation: async () => undefined,
}))
vi.mock('@perawallet/wallet-core-signing', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-signing')),
    useProgramSigner: () => ({ signProgram: async () => new Uint8Array(64) }),
    encodeProgramAccount: () => new Uint8Array([9]),
    useSignAndSubmitGroup: () => ({ submit }),
}))
vi.mock('../../fee-delegation', () => ({
    useFeeDelegation: () => ({ submitWithFeeDelegation }),
}))
vi.mock('@perawallet/wallet-core-accounts', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-accounts')),
    isDelegatedAccount: (account: WalletAccount) =>
        account.chains.algorand?.address === REKEYED_ADDRESS,
    canSignProgram: () => true,
}))
vi.mock('../../accounts/vocabulary', async () => ({
    ...(await vi.importActual<object>('../../accounts/vocabulary')),
    canSignArc60: () => true,
}))

import { AlgodError } from '../../blockchain'
import { algorandCardAdapter } from '../adapter'

const ADDRESS = 'A4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DVZ36IB4'
const REKEYED_ADDRESS = 'REKEYED'
const algorandAccount = (address: string) =>
    ({
        id: address,
        chains: { algorand: { address } },
    }) as unknown as WalletAccount
const signData = { data: 'ZGF0YQ==', authenticatorData: 'YXV0aA==' }

const arrangeClient = (client: object) =>
    getAlgorandClient.mockReturnValue({
        setDefaultValidityWindow: vi.fn(),
        setDefaultSigner: vi.fn(),
        ...client,
    })

cardContractTests(() => algorandCardAdapter, {
    scope: { chainId: 'algorand', networkId: 'testnet' },
    unconfiguredScope: { chainId: 'algorand', networkId: 'betanet' },
    delegationApproval: {
        address: ADDRESS,
        currency: 'usdc',
        txId: 'TX1',
        signData,
        signature: 'c2ln',
        token: 'tok',
    },
    balance: {
        address: ADDRESS,
        assetId: '10458941',
        arrangeNoHolding: () =>
            arrangeClient({
                client: {
                    algod: {
                        accountInformation: () => ({
                            do: async () => ({ assets: [] }),
                        }),
                    },
                },
            }),
    },
    deposit: {
        params: { sender: ADDRESS, cardAddress: ADDRESS, amount: 1n },
        arrangeBuild: () =>
            arrangeClient({
                newGroup: () => ({
                    addAssetTransfer: vi.fn(),
                    build: async () => ({ transactions: [{ txn: {} }] }),
                }),
            }),
    },
    eligibility: {
        account: algorandAccount(ADDRESS),
        ineligibleAccount: algorandAccount(REKEYED_ADDRESS),
    },
    insufficientBalanceError: new AlgodError('overspend', {} as never),
    ownLegNetwork: 'algorand',
    foreignLegNetwork: 'linea',
    autoDraw: {
        account: algorandAccount(ADDRESS),
        cardAddress: ADDRESS,
        // The switch's per-(account, asset) box exists exactly while it is on.
        arrangeState: enabled =>
            arrangeClient({
                client: {
                    algod: {
                        getApplicationBoxByName: () => ({
                            do: async () => {
                                if (!enabled) {
                                    throw Object.assign(new Error('box'), {
                                        response: { status: 404 },
                                    })
                                }
                                return { value: new Uint8Array() }
                            },
                        }),
                    },
                },
            }),
        submissions: () =>
            submit.mock.calls.length +
            submitWithFeeDelegation.mock.calls.length,
    },
})
