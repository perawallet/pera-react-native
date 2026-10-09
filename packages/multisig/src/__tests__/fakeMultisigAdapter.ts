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

import type { MultisigChainAdapter, MultisigParameters } from '../chain-adapter'

// A raw "transaction" here is just its base64-encoded sender.
export const fakeRawTransactionFrom = (sender: string): string => btoa(sender)

const deriveAddress = ({
    version,
    threshold,
    addresses,
}: MultisigParameters): string => {
    if (addresses.some(address => !/^[A-Z0-9]+$/.test(address))) {
        throw new Error('malformed participant address')
    }
    return `MSIG${version}${threshold}${addresses.join('')}`
}

export const fakeMultisigAdapter = (
    overrides: Partial<MultisigChainAdapter> = {},
): MultisigChainAdapter => ({
    chainId: 'algorand',
    deriveAddress,
    parametersOf: native =>
        native?.multisig
            ? { ...native.multisig, addresses: [...native.multisig.addresses] }
            : undefined,
    toNative: ({ version, threshold, addresses }) => ({
        family: 'algorand',
        multisig: { version, threshold, addresses: [...addresses] },
    }),
    assembleSignedTransactions: async ({ rawTransactionsBase64, threshold }) =>
        rawTransactionsBase64.length === 0
            ? { kind: 'success', signedTransactionsBytes: [] }
            : {
                  kind: 'insufficient-signatures',
                  txIndex: 0,
                  validCount: 0,
                  threshold,
              },
    validateSignRequest: (request, authorizedSenders) => {
        const { address, version, threshold, participantAddresses } =
            request.multisigAccount
        const list = request.transactionLists[0]
        if (!list) return { kind: 'no-transactions' }
        if (
            deriveAddress({
                version,
                threshold,
                addresses: participantAddresses,
            }) !== address
        ) {
            return { kind: 'address-mismatch' }
        }
        const txIndex = list.rawTransactions.findIndex(
            raw => !authorizedSenders.has(atob(raw)),
        )
        return txIndex === -1
            ? { kind: 'valid' }
            : { kind: 'unauthorized-sender', txIndex }
    },
    ...overrides,
})
