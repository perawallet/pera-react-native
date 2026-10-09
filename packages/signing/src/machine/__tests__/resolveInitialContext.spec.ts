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

import { describe, it, expect, vi } from 'vitest'
import '../../__tests__/registerAlgorandAccounts'
import { Address, Transaction, assignGroupID } from 'algosdk'
import {
    makeTestAddress,
    makeTestPaymentTx,
} from '../../__tests__/transactions'

import { resolveInitialContext } from '../actions'
import type { SigningMachineInput } from '../context'
import type {
    ArbitraryDataSignRequest,
    AuthDataSignRequest,
    SignRequest,
    TransactionSignRequest,
} from '../../models'
import { algo25Account, ledgerAccount } from '../../__tests__/accounts'
import {
    CannotSignError,
    HardwareWalletError,
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
        encodeTransaction: vi.fn(),
    }) as unknown as SigningMachineInput

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
            txs: [fullGroup[0]],
            groupContext: fullGroup,
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
            transport: 'algod',
            txs: fullGroup,
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
            txs: [stale[0]],
            groupContext: stale,
        }

        expect(() => resolveInitialContext(baseInput(request))).toThrow(
            InvalidSignableDataError,
        )
    })
})

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
            txs: [makePayment(userAddr, 1n)],
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
        // The fast-path isLocalAlgod branch in buildSourceMetadata — sourceType
        // defaults to 'local' and transport is not 'callback', so the metadata
        // collapses to `{ type: 'local' }` with no callbacks.
        const request: TransactionSignRequest = {
            id: 'req-local-algod',
            type: 'transactions',
            transport: 'algod',
            txs: [makePayment(userAddr, 1n)],
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
            txs: [makePayment(userAddr, 1n)],
            approve: txApprove,
        }

        const context = resolveInitialContext(baseInput(request))
        const { callbacks } = context.signableGroups![0].source

        const signed = [{ sig: new Uint8Array([1]) }] as never
        await callbacks?.approve?.({
            signedData: { type: 'transactions', signed },
        } as never)

        expect(txApprove).toHaveBeenCalledWith(signed)
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
            txs: [makePayment(userAddr, 1n)],
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
            txs: [makePayment(userAddr, 1n)],
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
            encodeTransaction: vi.fn(),
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
            transport: 'algod',
            txs: [makePayment(new Address(new Uint8Array(32).fill(3)), 1n)],
            // Override the signer so it lands on the hardware account.
            signerOverrides: new Map([[0, hwAddr]]),
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
            transport: 'algod',
            txs: [makePayment(strangerAddr, 1n)],
            signerOverrides: new Map([[0, strangerAddr.toString()]]),
        }

        // The signer is in txs but not in allAccounts; buildSignableGroups
        // silently skips it → resulting groups are empty → resolveInitialContext
        // throws "No signable transactions found".
        expect(() => resolveInitialContext(baseInput(request))).toThrow(
            CannotSignError,
        )
    })
})
