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
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import {
    registerAlgorandRulesAs,
    seedAuthority,
} from '../../__tests__/registerAlgorandAccounts'
import { Address, type Transaction, assignGroupID } from 'algosdk'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    ChainAdapterNotRegisteredError,
    ScopeChangedError,
    transactionPlanners,
    type AddressCodec,
} from '@perawallet/wallet-core-chain-contract'
import {
    SECOND_CHAIN_SCOPE,
    asUnsignedAlgorandTransaction,
    fakeAlgorandTransactionPlanner,
    makeTestAddress,
    makeTestPaymentTx,
    makeUnsignedTransaction,
    fakeTransactionPlanner,
    planFromPayload,
    registerFakeTransactionPlanner,
} from '../../__tests__/transactions'

import { recordReviewApproval } from '../../db/repository'
import { resolveInitialContext } from '../actions'
import { plannerChainAdapters } from '../../chain-adapter'
import { registerFakePlannerAdapter } from '../../__tests__/fakePlannerAdapter'
import type { SigningMachineInput } from '../context'
import type {
    ArbitraryDataSignRequest,
    AuthDataSignRequest,
    MessageSignRequest,
    SignRequest,
    TransactionSignRequest,
} from '../../models'
import {
    algo25Account,
    ledgerAccount,
    multisigAccount,
} from '../../__tests__/accounts'
import {
    CannotSignError,
    HardwareWalletError,
    GenesisHashMismatchError,
    InvalidSignableDataError,
    SigningError,
} from '../../pipeline/errors'

// assignGroupID stamps the group id in place.
const groupTransactions = (transactions: Transaction[]): Transaction[] => {
    assignGroupID(transactions)
    return transactions
}

const userAddr = makeTestAddress(1)
const dappAddr = makeTestAddress(2)

const makePayment = (sender: Address, amount: bigint): Transaction =>
    makeTestPaymentTx(sender, { receiver: dappAddr, amount })

const neutralPayment = (sender: Address, amount: bigint) =>
    asUnsignedAlgorandTransaction(makePayment(sender, amount))

const asNeutral = (transactions: Transaction[]) =>
    transactions.map(transaction => asUnsignedAlgorandTransaction(transaction))

const USER_ADDRESS = userAddr.toString()
const userAccount = algo25Account(USER_ADDRESS, { keyPairId: 'key-1' })

const baseInput = (request: SignRequest): SigningMachineInput =>
    ({
        request,
        allAccounts: [userAccount],
        signTransactions: vi.fn(),
        signArbitraryData: vi.fn(),
        signAuthData: vi.fn(),
        createTransport: vi.fn(),
        scope: { chainId: 'algorand', networkId: 'mainnet' },
    }) as unknown as SigningMachineInput

beforeEach(() => {
    registerFakeTransactionPlanner(fakeAlgorandTransactionPlanner())
})

describe('resolveInitialContext — group integrity validation', () => {
    it('passes when txs is the wallet subset and groupContext carries the full atomic group', () => {
        // Express-send shape: 2-tx atomic group, user signs only their tx.
        // Without groupContext the validator would see [userTx] and reject
        // it as a partial group. With groupContext it sees the full pair
        // and passes.
        const fullGroup = groupTransactions([
            makePayment(userAddr, 1n),
            makePayment(dappAddr, 0n),
        ])
        const request: TransactionSignRequest = {
            id: 'req-1',
            type: 'transactions',
            transport: 'callback',
            sourceType: 'walletconnect',
            txs: asNeutral([fullGroup[0]]),
            chainData: { algorand: { groupContext: asNeutral(fullGroup) } },
        }

        expect(() => resolveInitialContext(baseInput(request))).not.toThrow()
    })

    it('falls back to validating txs when groupContext is unset', () => {
        // Internal-source shape: txs is the full group, no groupContext.
        const fullGroup = groupTransactions([
            makePayment(userAddr, 1n),
            makePayment(userAddr, 2n),
        ])
        const request: TransactionSignRequest = {
            id: 'req-2',
            type: 'transactions',
            transport: 'network',
            txs: asNeutral(fullGroup),
        }

        expect(() => resolveInitialContext(baseInput(request))).not.toThrow()
    })

    it('throws when groupContext itself is a stale/partial group', () => {
        // dApp sent a 3-tx group with one tx removed before forwarding —
        // the survivors still carry the original group hash, so recompute
        // over the survivors won't match.
        const fullGroup = groupTransactions([
            makePayment(userAddr, 1n),
            makePayment(userAddr, 2n),
            makePayment(userAddr, 3n),
        ])
        const stale = [fullGroup[0], fullGroup[1]]
        const request: TransactionSignRequest = {
            id: 'req-3',
            type: 'transactions',
            transport: 'callback',
            sourceType: 'walletconnect',
            txs: asNeutral([stale[0]]),
            chainData: { algorand: { groupContext: asNeutral(stale) } },
        }

        expect(() => resolveInitialContext(baseInput(request))).toThrow(
            InvalidSignableDataError,
        )
    })
})

vi.mock('../../db/repository', async importOriginal => ({
    ...(await importOriginal<typeof import('../../db/repository')>()),
    recordReviewApproval: vi.fn(async () => 'recorded-token'),
}))

describe('resolveInitialContext — source callbacks', () => {
    it('threads reject and approveSignedBytes from a walletconnect request into source metadata', () => {
        // Multisig sync-flow handoff: createMultisigProposeTransport reads
        // these off source.callbacks to register the handoff, and the
        // resolver fires them to deliver to / soft-reject the dApp. They
        // must survive the SignRequest → SourceMetadata conversion.
        const approve = vi.fn()
        const reject = vi.fn()
        const approveSignedBytes = vi.fn()
        const request: TransactionSignRequest = {
            id: 'req-callbacks',
            type: 'transactions',
            transport: 'callback',
            sourceType: 'walletconnect',
            txs: [neutralPayment(userAddr, 1n)],
            approve,
            reject,
            approveSignedBytes,
        }

        const context = resolveInitialContext(baseInput(request))
        const { callbacks } = context.signableGroups![0].source

        expect(callbacks?.reject).toBe(reject)
        expect(callbacks?.approveSignedBytes).toBe(approveSignedBytes)
        expect(callbacks?.approve).toBeDefined()
    })

    it('produces minimal local metadata for local+algod requests (no callbacks wired)', () => {
        // The fast-path isLocalNetwork branch in buildSourceMetadata — sourceType
        // defaults to 'local' and transport is not 'callback', so the metadata
        // collapses to `{ type: 'local' }` with no callbacks.
        const request: TransactionSignRequest = {
            id: 'req-local-algod',
            type: 'transactions',
            transport: 'network',
            txs: [neutralPayment(userAddr, 1n)],
        }

        const context = resolveInitialContext(baseInput(request))
        const source = context.signableGroups![0].source as { type: string }
        expect(source.type).toBe('local')
        // No callbacks field on the minimal-local shape.
        expect((source as { callbacks?: unknown }).callbacks).toBeUndefined()
    })

    it('wraps the transaction approve callback so the signed payload reaches the dApp', async () => {
        // Verifies the transactions branch of the callback wrapper:
        // result.signedData.type === 'transactions' routes signed bytes back
        // to the request.approve hook.
        const txApprove = vi.fn(async () => undefined)
        const request: TransactionSignRequest = {
            id: 'req-tx-cb',
            type: 'transactions',
            transport: 'callback',
            sourceType: 'walletconnect',
            txs: [neutralPayment(userAddr, 1n)],
            approve: txApprove,
        }

        const context = resolveInitialContext(baseInput(request))
        const { callbacks } = context.signableGroups![0].source

        const signed = [{ sig: new Uint8Array([1]) }] as never
        await callbacks?.approve?.({
            signedData: { type: 'signed-transactions', signed },
        } as never)

        expect(txApprove).toHaveBeenCalledWith(signed, undefined)
    })

    describe('a review listing transactions to sign later', () => {
        const following = [neutralPayment(userAddr, 2n)]
        const deliver = async (
            sourceType: 'walletconnect' | 'local',
            followingTxs: TransactionSignRequest['followingTxs'],
        ) => {
            const txApprove = vi.fn(async () => undefined)
            const request: TransactionSignRequest = {
                id: 'req-batch',
                type: 'transactions',
                transport: 'callback',
                sourceType,
                txs: [neutralPayment(userAddr, 1n)],
                followingTxs,
                approve: txApprove,
            }
            const context = resolveInitialContext(baseInput(request))
            const signed = [{ sig: new Uint8Array([1]) }] as never
            await context.signableGroups![0].source.callbacks?.approve?.({
                signedData: { type: 'signed-transactions', signed },
            } as never)
            return { txApprove, request, signed }
        }

        beforeEach(() => {
            vi.mocked(recordReviewApproval).mockClear()
        })

        it('records everything the user approved when they approve it, and hands the caller its token', async () => {
            const { txApprove, request, signed } = await deliver(
                'walletconnect',
                following,
            )

            expect(recordReviewApproval).toHaveBeenCalledWith({
                scope: request.txs[0].scope,
                transactions: [...request.txs, ...following],
            })
            expect(txApprove).toHaveBeenCalledWith(signed, undefined, {
                token: 'recorded-token',
            })
        })

        it('records a batch of one, whose review lists nothing after its first transaction', async () => {
            const { txApprove, request, signed } = await deliver(
                'walletconnect',
                [],
            )

            expect(recordReviewApproval).toHaveBeenCalledWith({
                scope: request.txs[0].scope,
                transactions: request.txs,
            })
            expect(txApprove).toHaveBeenCalledWith(signed, undefined, {
                token: 'recorded-token',
            })
        })

        it('records nothing for a request that is no batch', async () => {
            const { txApprove, signed } = await deliver(
                'walletconnect',
                undefined,
            )

            expect(recordReviewApproval).not.toHaveBeenCalled()
            expect(txApprove).toHaveBeenCalledWith(signed, undefined)
        })

        it('records nothing for a source no one reviews', async () => {
            const { txApprove, signed } = await deliver('local', following)

            expect(recordReviewApproval).not.toHaveBeenCalled()
            expect(txApprove).toHaveBeenCalledWith(signed, undefined)
        })
    })

    it('hands the transport submission receipt to the transaction approve callback', async () => {
        const txApprove = vi.fn(async () => undefined)
        const request: TransactionSignRequest = {
            id: 'req-tx-receipt',
            type: 'transactions',
            transport: 'network',
            sourceType: 'gift-card',
            txs: [neutralPayment(userAddr, 1n)],
            approve: txApprove,
        }

        const context = resolveInitialContext(baseInput(request))
        const { callbacks } = context.signableGroups![0].source

        const signed = [{ sig: new Uint8Array([1]) }] as never
        await callbacks?.approve?.(
            { signedData: { type: 'signed-transactions', signed } } as never,
            { txIds: ['TX1'] },
        )

        expect(txApprove).toHaveBeenCalledWith(signed, { txIds: ['TX1'] })
    })

    it('multisig-cosign without signRequestId throws SigningError', () => {
        // Sourcetype is multisig-cosign but the request omits the
        // signRequestId — the metadata builder must throw rather than
        // silently default the field.
        const request: TransactionSignRequest = {
            id: 'req-cosign-no-id',
            type: 'transactions',
            transport: 'callback',
            sourceType: 'multisig-cosign',
            txs: [neutralPayment(userAddr, 1n)],
        }

        expect(() => resolveInitialContext(baseInput(request))).toThrow(
            SigningError,
        )
    })

    it('multisig-cosign with signRequestId emits cosign metadata', () => {
        const request: TransactionSignRequest = {
            id: 'req-cosign',
            type: 'transactions',
            transport: 'callback',
            sourceType: 'multisig-cosign',
            signRequestId: 'sr-42',
            txs: [neutralPayment(userAddr, 1n)],
        }

        const context = resolveInitialContext(baseInput(request))
        const source = context.signableGroups![0].source as {
            type: string
            signRequestId: string
        }
        expect(source.type).toBe('multisig-cosign')
        expect(source.signRequestId).toBe('sr-42')
    })
})

describe('resolveInitialContext — arbitrary-data requests', () => {
    it('produces a single signable group keyed off the first data signer', () => {
        const request: ArbitraryDataSignRequest = {
            id: 'req-arb',
            type: 'arbitrary-data',
            transport: 'callback',
            sourceType: 'walletconnect',
            data: [
                {
                    signer: USER_ADDRESS,
                    data: 'hello',
                    chainId: 4160,
                },
            ],
        }

        const context = resolveInitialContext(baseInput(request))
        expect(context.signableGroups).toHaveLength(1)
        expect(context.signableGroups![0].signerAddress).toBe(USER_ADDRESS)
        expect(context.signableGroups![0].data.type).toBe('arbitrary-data')
    })

    it('throws when the data array is empty', () => {
        // Defensive: `firstData` would be undefined; resolveInitialContext
        // must surface this as an error rather than letting the machine
        // construct a malformed group.
        const request: ArbitraryDataSignRequest = {
            id: 'req-arb-empty',
            type: 'arbitrary-data',
            transport: 'callback',
            sourceType: 'walletconnect',
            data: [],
        }

        expect(() => resolveInitialContext(baseInput(request))).toThrow(
            /No data in request/,
        )
    })

    it('throws when items in the data array claim different signers', () => {
        // Security: the whole group is bound to data[0].signer and signed with
        // that one account. Items claiming a different signer must be rejected
        // rather than silently signed by the first signer's key.
        const request: ArbitraryDataSignRequest = {
            id: 'req-arb-mismatch',
            type: 'arbitrary-data',
            transport: 'callback',
            sourceType: 'walletconnect',
            data: [
                { signer: USER_ADDRESS, data: 'hello', chainId: 4160 },
                { signer: 'OTHER_SIGNER', data: 'world', chainId: 4160 },
            ],
        }

        expect(() => resolveInitialContext(baseInput(request))).toThrow(
            /signer/i,
        )
    })

    it('wraps the approve callback to project signatures back to the request', async () => {
        const arbApprove = vi.fn(async () => undefined)
        const request: ArbitraryDataSignRequest = {
            id: 'req-arb-cb',
            type: 'arbitrary-data',
            transport: 'callback',
            sourceType: 'walletconnect',
            data: [{ signer: USER_ADDRESS, data: 'hello', chainId: 4160 }],
            approve: arbApprove,
        }

        const context = resolveInitialContext(baseInput(request))
        const { callbacks } = context.signableGroups![0].source
        const sig = new Uint8Array([9, 9, 9])

        await callbacks?.approve?.({
            signedData: { type: 'arbitrary-data', signatures: [sig] },
            signers: [{ address: USER_ADDRESS }],
        } as never)

        expect(arbApprove).toHaveBeenCalledWith([
            { signature: sig, signer: USER_ADDRESS },
        ])
    })

    it('maps every signature to the single resolved signer (not signers[i])', async () => {
        // All items share one signer (enforced at build time), so each
        // signature must be attributed to that signer — never an empty string
        // for items beyond the first.
        const arbApprove = vi.fn(async () => undefined)
        const request: ArbitraryDataSignRequest = {
            id: 'req-arb-multi',
            type: 'arbitrary-data',
            transport: 'callback',
            sourceType: 'walletconnect',
            data: [
                { signer: USER_ADDRESS, data: 'one', chainId: 4160 },
                { signer: USER_ADDRESS, data: 'two', chainId: 4160 },
            ],
            approve: arbApprove,
        }

        const context = resolveInitialContext(baseInput(request))
        const { callbacks } = context.signableGroups![0].source
        const sigA = new Uint8Array([1])
        const sigB = new Uint8Array([2])

        await callbacks?.approve?.({
            signedData: { type: 'arbitrary-data', signatures: [sigA, sigB] },
            signers: [{ address: USER_ADDRESS }],
        } as never)

        expect(arbApprove).toHaveBeenCalledWith([
            { signature: sigA, signer: USER_ADDRESS },
            { signature: sigB, signer: USER_ADDRESS },
        ])
    })
})

describe('resolveInitialContext — auth-data requests', () => {
    const authData = {
        data: 'e30=',
        signer: USER_ADDRESS,
        domain: 'example.io',
        authenticatorData: new Uint8Array(37),
    }
    const metadata = { scope: 1, encoding: 'base64' }

    it('produces a single signable auth-data group keyed off authData.signer', () => {
        const request: AuthDataSignRequest = {
            id: 'req-auth-data',
            type: 'auth-data',
            transport: 'callback',
            sourceType: 'walletconnect',
            authData,
            metadata,
        }

        const context = resolveInitialContext(baseInput(request))
        expect(context.signableGroups).toHaveLength(1)
        expect(context.signableGroups![0].data.type).toBe('auth-data')
        expect(context.signableGroups![0].signerAddress).toBe(USER_ADDRESS)
    })

    it('wraps the approve callback to project the single signature into the [{signature,signer}] shape', async () => {
        const authDataApprove = vi.fn(async () => undefined)
        const request: AuthDataSignRequest = {
            id: 'req-auth-data-cb',
            type: 'auth-data',
            transport: 'callback',
            sourceType: 'walletconnect',
            authData,
            metadata,
            approve: authDataApprove,
        }

        const context = resolveInitialContext(baseInput(request))
        const { callbacks } = context.signableGroups![0].source
        const sig = new Uint8Array([7])

        await callbacks?.approve?.({
            signedData: { type: 'auth-data', signature: sig },
            signers: [{ address: USER_ADDRESS }],
        } as never)

        expect(authDataApprove).toHaveBeenCalledWith([
            { signature: sig, signer: USER_ADDRESS },
        ])
    })
})

describe('resolveInitialContext — message requests', () => {
    const messageRequest = (
        networkId = 'mainnet',
        overrides: Partial<MessageSignRequest> = {},
    ): MessageSignRequest => ({
        id: 'req-message',
        type: 'message',
        transport: 'callback',
        sourceType: 'walletconnect',
        message: {
            scope: { chainId: 'algorand', networkId },
            method: 'plain',
            signer: USER_ADDRESS,
            payload: { message: '0x68' },
        },
        ...overrides,
    })

    it('produces one message group keyed by the message signer', () => {
        const context = resolveInitialContext(baseInput(messageRequest()))

        expect(context.signableGroups).toHaveLength(1)
        expect(context.signableGroups![0]).toMatchObject({
            data: { type: 'message' },
            signerAddress: USER_ADDRESS,
        })
        expect(context.groupSigners?.get(USER_ADDRESS)?.custody).toBe('local')
    })

    it('refuses a request stamped for a network the actor is not on', () => {
        expect(() =>
            resolveInitialContext(baseInput(messageRequest('testnet'))),
        ).toThrow(ScopeChangedError)
    })

    it('hands the signed message to the request approve callback as is', async () => {
        const approve = vi.fn(async () => undefined)
        const context = resolveInitialContext(
            baseInput(messageRequest('mainnet', { approve })),
        )
        const { callbacks } = context.signableGroups![0].source
        const signed = {
            scope: { chainId: 'algorand', networkId: 'mainnet' },
            signature: { bytes: new Uint8Array([7]) },
        }

        await callbacks?.approve?.({
            signedData: { type: 'message', signed },
            signers: [{ address: USER_ADDRESS }],
        } as never)

        expect(approve).toHaveBeenCalledWith(signed)
    })

    it('refuses a signer the wallet does not hold', () => {
        const request = messageRequest()
        request.message.signer = makeTestAddress(9).toString()

        expect(() => resolveInitialContext(baseInput(request))).toThrow(
            CannotSignError,
        )
    })
})

describe('resolveInitialContext — hardware wallet registry requirement', () => {
    const HW_ADDRESS = new Address(new Uint8Array(32).fill(3)).toString()
    const hardwareAccount = ledgerAccount(HW_ADDRESS, 0, { deviceId: 'd1' })

    const buildHardwareInput = (
        request: TransactionSignRequest,
        opts: { hardwareWalletRegistry?: unknown } = {},
    ): SigningMachineInput =>
        ({
            request,
            allAccounts: [hardwareAccount],
            signTransactions: vi.fn(),
            signArbitraryData: vi.fn(),
            signAuthData: vi.fn(),
            createTransport: vi.fn(),
            scope: { chainId: 'algorand', networkId: 'mainnet' },
            hardwareWalletRegistry: opts.hardwareWalletRegistry,
        }) as unknown as SigningMachineInput

    it('throws HardwareWalletError when a hardware signer is present but no registry was provided', () => {
        // Critical wiring guard: hardware actors require a registry to call
        // the device. The machine refuses to start rather than failing
        // partway through.
        const hwAddr = HW_ADDRESS
        const request: TransactionSignRequest = {
            id: 'req-hw',
            type: 'transactions',
            transport: 'network',
            txs: [neutralPayment(new Address(new Uint8Array(32).fill(3)), 1n)],
            chainData: {
                algorand: {
                    // Override the signer so it lands on the hardware account.
                    signerOverrides: new Map([[0, hwAddr]]),
                },
            },
        }

        expect(() =>
            resolveInitialContext(buildHardwareInput(request)),
        ).toThrow(HardwareWalletError)
    })
})

describe('resolveInitialContext — signer account not found', () => {
    it('throws CannotSignError when the signer address is not in allAccounts', () => {
        // `txs[0].sender` resolves to an address that doesn't exist in the
        // wallet. Internal flows always include the sender, so this is the
        // belt-and-suspenders guard for malformed callers.
        const strangerAddr = new Address(new Uint8Array(32).fill(9))
        const request: TransactionSignRequest = {
            id: 'req-no-signer',
            type: 'transactions',
            transport: 'network',
            txs: [neutralPayment(strangerAddr, 1n)],
            chainData: {
                algorand: {
                    signerOverrides: new Map([[0, strangerAddr.toString()]]),
                },
            },
        }

        // The signer is in txs but not in allAccounts; buildSignableGroups
        // silently skips it → resulting groups are empty → resolveInitialContext
        // throws "No signable transactions found".
        expect(() => resolveInitialContext(baseInput(request))).toThrow(
            CannotSignError,
        )
    })
})

describe('resolveInitialContext: chain-neutral transaction requests', () => {
    const OURS = '0xOURS'
    const ALSO_OURS = '0xALSO_OURS'
    const STRANGER = '0xSTRANGER'

    const accountOnSecondChain = (address: string): WalletAccount =>
        ({
            ...userAccount,
            address: `${address}-algorand`,
            chains: { ethereum: { address, keyPairId: 'key-1' } },
        }) as unknown as WalletAccount

    const input = (
        txs: ReturnType<typeof makeUnsignedTransaction>[],
    ): SigningMachineInput => ({
        ...baseInput({
            id: 'req-neutral',
            type: 'transactions',
            transport: 'network',
            txs,
        }),
        allAccounts: [
            accountOnSecondChain(OURS),
            accountOnSecondChain(ALSO_OURS),
        ],
        scope: SECOND_CHAIN_SCOPE,
    })

    beforeAll(() => {
        registerAlgorandRulesAs(SECOND_CHAIN_SCOPE.chainId)
        // Compares as Ethereum's codec does: case doesn't matter.
        if (!addressCodecs.has(SECOND_CHAIN_SCOPE.chainId)) {
            addressCodecs.register({
                chainId: SECOND_CHAIN_SCOPE.chainId,
                areEqual: (a: string, b: string) =>
                    a.toLowerCase() === b.toLowerCase(),
            } as AddressCodec)
        }
    })

    beforeEach(() => {
        registerFakeTransactionPlanner()
    })

    describe('delivery callbacks', () => {
        const signed = {
            scope: SECOND_CHAIN_SCOPE,
            id: 'tx-id',
            bytes: new Uint8Array([1]),
        }
        const approve = vi.fn(async () => undefined)
        const approveSignedBytes = vi.fn(async () => undefined)
        const onProposed = vi.fn(async () => undefined)

        const withCallbacks = (): SigningMachineInput => {
            const base = input([makeUnsignedTransaction(OURS)])
            return {
                ...base,
                request: {
                    ...base.request,
                    transport: 'callback',
                    sourceType: 'walletconnect',
                    transportId: 'peer-1',
                    approve,
                    approveSignedBytes,
                    onProposed,
                    chainData: {
                        algorand: {
                            payloadId: 77,
                            totalLength: 3,
                            signableIndices: [2],
                        },
                    },
                } as TransactionSignRequest,
            }
        }
        const sourceOf = () =>
            resolveInitialContext(withCallbacks()).signableGroups![0].source

        afterEach(() => plannerChainAdapters.reset())

        it("hands approve the chain's signed transactions for the result", async () => {
            const signedTransactionsOf = vi.fn(() => [signed, null])
            registerFakePlannerAdapter({
                chainId: SECOND_CHAIN_SCOPE.chainId,
                signedTransactionsOf,
            })
            const result = {
                signedData: { type: 'transactions', signed: [] },
                signers: [],
            } as never
            const submission = { txIds: ['tx-id'] }

            await sourceOf().callbacks?.approve?.(result, submission)

            expect(signedTransactionsOf).toHaveBeenCalledWith(
                result,
                SECOND_CHAIN_SCOPE,
            )
            expect(approve).toHaveBeenCalledWith([signed, null], submission)
        })

        it("hands approve the planner's own signed transactions on a chain without a signing planner", async () => {
            const result = {
                signedData: {
                    type: 'signed-transactions',
                    signed: [signed],
                    historyEntries: [],
                },
                signers: [],
            } as never
            const submission = { txIds: ['tx-id'] }

            await sourceOf().callbacks?.approve?.(result, submission)

            expect(approve).toHaveBeenCalledWith([signed], submission)
        })

        it('carries no callbacks on a local algod request, whatever callbacks it holds', () => {
            const base = input([makeUnsignedTransaction(OURS)])
            const source = resolveInitialContext({
                ...base,
                request: {
                    ...base.request,
                    sourceType: 'local',
                    transport: 'network',
                    approve,
                },
            }).signableGroups![0].source

            expect(source).toEqual({ type: 'local' })
        })

        it('wires approve on a local submit-and-answer request', async () => {
            const base = input([makeUnsignedTransaction(OURS)])
            const source = resolveInitialContext({
                ...base,
                request: {
                    ...base.request,
                    sourceType: 'local',
                    transport: 'submit-and-answer',
                    approve,
                },
            }).signableGroups![0].source
            const submission = { txIds: ['tx-id'] }

            await source.callbacks?.approve?.(
                {
                    signedData: {
                        type: 'signed-transactions',
                        signed: [signed],
                        historyEntries: [],
                    },
                    signers: [],
                } as never,
                submission,
            )

            expect(source.type).toBe('local')
            expect(approve).toHaveBeenCalledWith([signed], submission)
        })

        it('forwards the byte and proposal callbacks it carries', () => {
            const { callbacks } = sourceOf()

            expect(callbacks?.approveSignedBytes).toBe(approveSignedBytes)
            expect(callbacks?.onProposed).toBe(onProposed)
        })

        it("builds the multisig handoff from its chain's group facts", () => {
            registerFakePlannerAdapter({ chainId: SECOND_CHAIN_SCOPE.chainId })

            expect(sourceOf().handoffDelivery).toEqual({
                clientId: 'peer-1',
                payloadId: 77,
                indicesToSign: [2],
                totalLength: 3,
            })
        })
    })

    it("groups each transaction under the signer its chain's planner names, keeping its position", () => {
        const txs = [
            makeUnsignedTransaction(OURS),
            makeUnsignedTransaction(ALSO_OURS),
            makeUnsignedTransaction(OURS),
        ]

        const context = resolveInitialContext(input(txs))

        expect(context.signableGroups).toEqual([
            expect.objectContaining({
                data: {
                    type: 'transactions',
                    transactions: [txs[0], txs[2]],
                },
                signerAddress: OURS,
                originalIndices: [0, 2],
            }),
            expect.objectContaining({
                data: {
                    type: 'transactions',
                    transactions: [txs[1]],
                },
                signerAddress: ALSO_OURS,
                originalIndices: [1],
            }),
        ])
    })

    it('leaves out a transaction no wallet account signs', () => {
        const ours = makeUnsignedTransaction(OURS)

        const context = resolveInitialContext(
            input([makeUnsignedTransaction(STRANGER), ours]),
        )

        expect(context.signableGroups?.map(g => g.originalIndices)).toEqual([
            [1],
        ])
    })

    it("refuses a transaction built on a network other than the chain's selected one", () => {
        const onTestnet = makeUnsignedTransaction(OURS, {
            ...SECOND_CHAIN_SCOPE,
            networkId: 'sepolia',
        })

        expect(() => resolveInitialContext(input([onTestnet]))).toThrow(
            ScopeChangedError,
        )
    })

    it("refuses a transaction for a chain other than the request's", () => {
        const algorandTx = makeUnsignedTransaction(OURS, {
            chainId: 'algorand',
            networkId: 'mainnet',
        })

        expect(() =>
            resolveInitialContext(
                input([makeUnsignedTransaction(OURS), algorandTx]),
            ),
        ).toThrow(InvalidSignableDataError)
    })

    it('refuses a chain with no transaction planner', () => {
        transactionPlanners.reset()

        expect(() =>
            resolveInitialContext(input([makeUnsignedTransaction(OURS)])),
        ).toThrow(ChainAdapterNotRegisteredError)
    })

    it('keys a transaction several signers sign to the first one the wallet holds', () => {
        registerFakeTransactionPlanner(
            fakeTransactionPlanner(transaction => [
                { ...planFromPayload(transaction)[0], signer: STRANGER },
                { ...planFromPayload(transaction)[0], requestIndex: 1 },
                {
                    ...planFromPayload(transaction)[0],
                    requestIndex: 2,
                    signer: ALSO_OURS,
                },
            ]),
        )

        const context = resolveInitialContext(
            input([makeUnsignedTransaction(OURS)]),
        )

        expect(context.signableGroups).toEqual([
            expect.objectContaining({
                signerAddress: OURS,
                originalIndices: [0],
            }),
        ])
    })

    it("groups under the wallet's spelling of a signer the planner spells differently", () => {
        const txs = [
            makeUnsignedTransaction(OURS.toLowerCase()),
            makeUnsignedTransaction(OURS),
        ]

        const context = resolveInitialContext(input(txs))

        expect(context.signableGroups).toEqual([
            expect.objectContaining({
                signerAddress: OURS,
                originalIndices: [0, 1],
            }),
        ])
    })

    it('refuses a request no wallet account signs', () => {
        expect(() =>
            resolveInitialContext(input([makeUnsignedTransaction(STRANGER)])),
        ).toThrow(CannotSignError)
    })

    it("refuses a payload the chain's planner can't read, as untrusted data", () => {
        registerFakeTransactionPlanner(
            fakeTransactionPlanner(() => {
                throw new Error('The payload is malformed')
            }),
        )

        expect(() =>
            resolveInitialContext(input([makeUnsignedTransaction(OURS)])),
        ).toThrow(InvalidSignableDataError)
    })

    it("keeps a payload for another network's own error", () => {
        const mismatch = new GenesisHashMismatchError(
            'mainnet',
            0,
            'expected',
            'actual',
        )
        registerFakeTransactionPlanner(
            fakeTransactionPlanner(() => {
                throw mismatch
            }),
        )

        expect(() =>
            resolveInitialContext(input([makeUnsignedTransaction(OURS)])),
        ).toThrow(mismatch)
    })

    it.each([
        ['chain-neutral', 'Algorand'],
        ['Algorand', 'chain-neutral'],
    ])(
        'refuses a request that mixes %s then %s transactions',
        (first, _second) => {
            const neutral = makeUnsignedTransaction(OURS)
            const algorand = makePayment(userAddr, 1n)
            const mixed = (first === 'Algorand'
                ? [algorand, neutral]
                : [neutral, algorand]) as unknown as ReturnType<
                typeof makeUnsignedTransaction
            >[]

            expect(() => resolveInitialContext(input(mixed))).toThrow(
                InvalidSignableDataError,
            )
        },
    )
})

describe('resolveInitialContext: Algorand chain-neutral requests', () => {
    const authAddr = makeTestAddress(3)
    const strangerAddr = makeTestAddress(4)

    beforeEach(() => {
        registerFakeTransactionPlanner(fakeAlgorandTransactionPlanner())
    })

    // The WalletConnect shape: the wallet's subset, the full group beside it,
    // and an ARC-0001 signer override.
    const fullGroup = () =>
        groupTransactions([
            makePayment(userAddr, 1n),
            makePayment(strangerAddr, 2n),
            makePayment(userAddr, 3n),
            makePayment(userAddr, 4n),
        ])

    const bothShapes = (group: Transaction[]) => {
        const txs = [group[0], group[2], group[3]]
        const signerOverrides = new Map([[2, authAddr.toString()]])
        const raw = ['raw-0', 'raw-2', 'raw-3']
        const algorand: TransactionSignRequest = {
            id: 'req-algorand',
            type: 'transactions',
            chainId: 'algorand',
            transport: 'callback',
            sourceType: 'walletconnect',
            txs,
            groupContext: group,
            signableIndices: [0, 2, 3],
            signerOverrides,
            rawTransactionsBase64: raw,
        }
        const neutral: TransactionSignRequest = {
            id: 'req-neutral',
            type: 'transactions',
            transport: 'callback',
            sourceType: 'walletconnect',
            txs: txs.map(txn => asUnsignedAlgorandTransaction(txn)),
            chainData: {
                algorand: {
                    groupContext: group.map(txn =>
                        asUnsignedAlgorandTransaction(txn),
                    ),
                    signableIndices: [0, 2, 3],
                    signerOverrides,
                    rawTransactionsBase64: raw,
                },
            },
        }
        return { algorand, neutral }
    }

    const withAccounts = (
        request: TransactionSignRequest,
        auth = algo25Account(authAddr.toString(), { id: 'auth' }),
    ) => ({
        ...baseInput(request),
        hardwareWalletRegistry: {} as never,
        allAccounts: [userAccount, auth],
    })
    const ledgerAuth = () =>
        ledgerAccount(authAddr.toString(), 0, {}, { id: 'auth' })

    it('groups each transaction under the account it signs for, following its signer override', () => {
        const { neutral } = bothShapes(fullGroup())

        const context = resolveInitialContext(withAccounts(neutral))

        expect(
            context.signableGroups?.map(g => [
                g.signerAddress,
                g.originalIndices,
            ]),
        ).toEqual([
            [USER_ADDRESS, [0, 1]],
            [authAddr.toString(), [2]],
        ])
        expect(context.groupSigners).toEqual(
            new Map([
                [USER_ADDRESS, { custody: 'local', scheme: 'ed25519' }],
                [authAddr.toString(), { custody: 'local', scheme: 'ed25519' }],
            ]),
        )
    })

    it('refuses a request whose transactions are in the Algorand shape', () => {
        const { algorand } = bothShapes(fullGroup())

        expect(() => resolveInitialContext(withAccounts(algorand))).toThrow(
            InvalidSignableDataError,
        )
    })

    it('refuses an empty request as having nothing to sign', () => {
        const request: TransactionSignRequest = {
            id: 'req-empty',
            type: 'transactions',
            transport: 'network',
            txs: [],
        }

        expect(() => resolveInitialContext(withAccounts(request))).toThrow(
            CannotSignError,
        )
    })

    it("carries each group's indices and request bytes as its Algorand group facts", () => {
        const { neutral } = bothShapes(fullGroup())

        const context = resolveInitialContext(withAccounts(neutral))

        expect(context.signableGroups?.map(g => g.data)).toEqual([
            expect.objectContaining({
                chainData: {
                    algorand: {
                        indicesToSign: [0, 1],
                        rawTransactionsBase64: ['raw-0', 'raw-2'],
                    },
                },
            }),
            expect.objectContaining({
                chainData: {
                    algorand: {
                        indicesToSign: [0],
                        rawTransactionsBase64: ['raw-3'],
                    },
                },
            }),
        ])
    })

    it('plans a request signed by a local key and a Ledger, so neither goes to the chain signer', () => {
        const { neutral } = bothShapes(fullGroup())

        const context = resolveInitialContext(
            withAccounts(neutral, ledgerAuth()),
        )

        expect(context.signableGroups).toEqual([
            expect.objectContaining({
                signerAddress: USER_ADDRESS,
                originalIndices: [0, 1],
                data: {
                    type: 'transactions',
                    transactions: [neutral.txs[0], neutral.txs[1]],
                    chainData: {
                        algorand: {
                            indicesToSign: [0, 1],
                            rawTransactionsBase64: ['raw-0', 'raw-2'],
                        },
                    },
                },
            }),
            expect.objectContaining({
                signerAddress: authAddr.toString(),
                originalIndices: [2],
                data: {
                    type: 'transactions',
                    transactions: [neutral.txs[2]],
                    chainData: {
                        algorand: {
                            indicesToSign: [0],
                            rawTransactionsBase64: ['raw-3'],
                        },
                    },
                },
            }),
        ])
        expect(
            context.signableGroups?.some(group => group.shouldUseChainSigner),
        ).toBe(false)
        expect(context.groupSigners).toEqual(
            new Map([
                [USER_ADDRESS, { custody: 'local', scheme: 'ed25519' }],
                [
                    authAddr.toString(),
                    { custody: 'hardware', scheme: 'ed25519' },
                ],
            ]),
        )
    })

    it("signs a request whose signers sign in different ways through the chain's own signers", () => {
        const { neutral } = bothShapes(fullGroup())

        const context = resolveInitialContext(
            withAccounts(
                neutral,
                multisigAccount(authAddr.toString(), undefined, { id: 'auth' }),
            ),
        )

        expect(
            context.signableGroups?.map(group => group.shouldUseChainSigner),
        ).toEqual([true, true])
    })

    it('refuses a full group whose transactions no longer hash to their group id', () => {
        const group = fullGroup()
        const { neutral } = bothShapes(group)
        const stale = {
            ...neutral,
            chainData: {
                algorand: {
                    ...neutral.chainData!.algorand,
                    groupContext: group
                        .slice(0, 3)
                        .map(txn => asUnsignedAlgorandTransaction(txn)),
                },
            },
        } as TransactionSignRequest

        expect(() => resolveInitialContext(withAccounts(stale))).toThrow(
            InvalidSignableDataError,
        )
    })

    it("follows a sender's rekey once to the custody that signs for it", () => {
        const txn = makePayment(userAddr, 1n)
        const request: TransactionSignRequest = {
            id: 'req-rekeyed',
            type: 'transactions',
            transport: 'network',
            txs: [
                asUnsignedAlgorandTransaction(txn, {
                    authorizer: authAddr.toString(),
                }),
            ],
        }
        seedAuthority(USER_ADDRESS, authAddr.toString())

        const context = resolveInitialContext(
            withAccounts(request, ledgerAuth()),
        )

        expect(context.signableGroups?.[0].signerAddress).toBe(USER_ADDRESS)
        expect(context.groupSigners?.get(USER_ADDRESS)?.custody).toBe(
            'hardware',
        )
        seedAuthority(USER_ADDRESS, null)
    })
})
