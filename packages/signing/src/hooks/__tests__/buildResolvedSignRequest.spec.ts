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

import { describe, it, expect } from 'vitest'
import { buildResolvedSignRequest } from '../buildResolvedSignRequest'
import type { SigningMachineContext } from '../../machine/context'
import type { TransactionSignRequest, AuthDataSignRequest } from '../../models'

const CUSTODY = {
    algo25: { kind: 'local', seed: 'algo25' },
    hardware: { kind: 'hardware' },
    multisig: { kind: 'multisig' },
}

const makeAccount = (address: string, type: keyof typeof CUSTODY = 'algo25') =>
    ({ address, custody: CUSTODY[type] }) as any

describe('buildResolvedSignRequest', () => {
    it('returns null when context has no signerAddress (failed pre-resolution)', () => {
        const context = {
            signerAddress: null,
            request: {
                type: 'transactions',
                sourceType: 'local',
            } as TransactionSignRequest,
            allAccounts: [],
            groupSignerTypes: null,
        } as unknown as SigningMachineContext

        const result = buildResolvedSignRequest(context)

        expect(result).toBeNull()
    })

    it('resolves localKey signer for an algo25 account on a local tx', () => {
        const account = makeAccount('A123', 'algo25')
        const context = {
            signerAddress: 'A123',
            allAccounts: [account],
            groupSignerTypes: new Map([['A123', 'localKey']]),
            request: {
                id: 'r1',
                type: 'transactions',
                sourceType: 'local',
                transport: 'algod',
                txs: [{}],
            } as TransactionSignRequest,
            signableGroups: [{ signerAddress: 'A123' }],
        } as unknown as SigningMachineContext

        const result = buildResolvedSignRequest(context)

        expect(result).not.toBeNull()
        expect(result!.signerType).toBe('localKey')
        expect(result!.signerAccount).toBe(account)
        expect(result!.source).toEqual({ kind: 'local', isInteractive: false })
        expect(result!.transport).toEqual({ kind: 'algod' })
        expect(result!.kind).toEqual({
            type: 'transactions',
            isMultisigCosign: false,
            cosignSignerAddress: null,
            hasMultiple: false,
        })
    })

    it('identifies multisig-cosign with cosignSignerAddress from signerOverrides', () => {
        const account = makeAccount('A123', 'multisig')
        const context = {
            signerAddress: 'A123',
            allAccounts: [account],
            groupSignerTypes: new Map([['A123', 'multisig']]),
            request: {
                id: 'r1',
                type: 'transactions',
                sourceType: 'multisig-cosign',
                transport: 'callback',
                signRequestId: 'sr1',
                txs: [{}, {}],
                signerOverrides: new Map([[0, 'PARTICIPANT_ADDR']]),
            } as TransactionSignRequest,
            signableGroups: [{ signerAddress: 'A123' }],
        } as unknown as SigningMachineContext

        const result = buildResolvedSignRequest(context)

        expect(result!.kind).toEqual({
            type: 'transactions',
            isMultisigCosign: true,
            cosignSignerAddress: 'PARTICIPANT_ADDR',
            hasMultiple: true,
        })
        expect(result!.source).toEqual({
            kind: 'multisig-cosign',
            isInteractive: true,
        })
    })

    it('parses auth-data payload once and exposes it on kind', () => {
        const account = makeAccount('A123', 'algo25')
        const authDataRequest = {
            id: 'r1',
            type: 'auth-data',
            sourceType: 'card',
            transport: 'callback',
            authData: { data: 'SGVsbG8=', signer: 'A123' },
            metadata: { scope: 1, encoding: 'base64' },
        } as unknown as AuthDataSignRequest

        const context = {
            signerAddress: 'A123',
            allAccounts: [account],
            groupSignerTypes: new Map([['A123', 'localKey']]),
            request: authDataRequest,
            signableGroups: [{ signerAddress: 'A123' }],
        } as unknown as SigningMachineContext

        const result = buildResolvedSignRequest(context)

        expect(result!.kind.type).toBe('auth-data')
        if (result!.kind.type === 'auth-data') {
            expect(result!.kind.parsed).toBeDefined()
        }
    })
})
