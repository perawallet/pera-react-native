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

import { useCallback, useMemo } from 'react'
import {
    addressCodecs,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import {
    chainIdOfSignRequest,
    isExternalCallbackSource,
    resolveAllSignerAddresses,
    reviewedAddressesOf,
    scopeOfSignRequest,
    useSigningPipeline,
    useSigningRequest,
    type ReviewedAddress,
    type ReviewedAddressRole,
} from '@perawallet/wallet-core-signing'
import { useListedAddressesQuery } from '@perawallet/wallet-core-site-safety'
import {
    assessRequestAddress,
    type RequestAddressAssessment,
} from '@perawallet/wallet-core-transactions'
import { useIsListedAddressHardBlockEnabled } from '@hooks/useIsListedAddressHardBlockEnabled'
import { useKnownAddresses } from '@modules/transactions'
import { createAcknowledgementStore } from './createAcknowledgementStore'

export type FlaggedRequestAddress = {
    address: string
    role: ReviewedAddressRole
    assessment: Exclude<RequestAddressAssessment, { kind: 'clear' }>
}

export type UseRequestAddressSafetyResult = {
    flaggedAddresses: FlaggedRequestAddress[]
    /** The network the request was built for; undefined when it names none. */
    scope: Optional<ChainScope>
    isChecking: boolean
    /** The request names a scam-listed address. */
    hasListedAddress: boolean
    /** A listed address cannot be acknowledged away, so the request can only be rejected; false once remote config turns the hard block off. */
    isListedAddressBlocking: boolean
    isAcknowledged: boolean
    toggleAcknowledged: () => void
    isConfirmBlocked: boolean
}

export const useAddressWarningAcknowledgementStore = createAcknowledgementStore(
    'address-warning-acknowledgement-store',
)

const NO_ADDRESSES: ReviewedAddress[] = []

export const useTransactionRequestAddresses = (): ReviewedAddress[] => {
    const { currentRequest } = useSigningRequest()
    const { allTransactions } = useSigningPipeline()

    return useMemo(() => {
        if (!currentRequest || allTransactions.length === 0) {
            return NO_ADDRESSES
        }
        const chainId = chainIdOfSignRequest(currentRequest)
        return allTransactions.flatMap(transaction =>
            reviewedAddressesOf(chainId, transaction),
        )
    }, [currentRequest, allTransactions])
}

const dedupe = (
    addresses: readonly ReviewedAddress[],
    chainId: ChainId,
): ReviewedAddress[] => {
    const codec = addressCodecs.get(chainId)
    return addresses.filter(
        (reviewed, index) =>
            addresses.findIndex(other =>
                codec.areEqual(other.address, reviewed.address),
            ) === index,
    )
}

export const useRequestAddressSafety = ({
    addresses,
}: {
    addresses?: readonly ReviewedAddress[]
} = {}): UseRequestAddressSafetyResult => {
    const { currentRequest } = useSigningRequest()
    const transactionAddresses = useTransactionRequestAddresses()
    const acknowledgedRequestId = useAddressWarningAcknowledgementStore(
        state => state.acknowledgedRequestId,
    )
    const setAcknowledgedRequestId = useAddressWarningAcknowledgementStore(
        state => state.setAcknowledgedRequestId,
    )

    const scope = currentRequest
        ? scopeOfSignRequest(currentRequest)
        : undefined
    const chainId = scope?.chainId
    const isDappRequest =
        !!currentRequest && isExternalCallbackSource(currentRequest.sourceType)

    const reviewed = useMemo(
        () =>
            isDappRequest && chainId
                ? dedupe(addresses ?? transactionAddresses, chainId)
                : NO_ADDRESSES,
        [isDappRequest, chainId, addresses, transactionAddresses],
    )
    const isEnabled = reviewed.length > 0

    const signerAddress = useMemo(
        () =>
            currentRequest && chainId && isEnabled
                ? resolveAllSignerAddresses(chainId, currentRequest)[0]
                : undefined,
        [currentRequest, chainId, isEnabled],
    )
    // History only sharpens the look-alike check; a dApp review mustn't wait on
    // the network for it.
    const { knownAddresses } = useKnownAddresses({
        scope,
        senderAddress: signerAddress,
        isEnabled,
        isSenderHistoryOnly: true,
    })
    const { isListed, isChecking } = useListedAddressesQuery({
        addresses: reviewed.map(({ address }) => address),
        isEnabled,
    })

    const flaggedAddresses = useMemo(() => {
        if (!chainId || isChecking) return []
        return reviewed.flatMap(
            ({ address, role }): FlaggedRequestAddress[] => {
                const assessment = assessRequestAddress({
                    address,
                    chainId,
                    knownAddresses,
                    isListed: isListed(address),
                })
                return assessment.kind === 'clear'
                    ? []
                    : [{ address, role, assessment }]
            },
        )
    }, [chainId, isChecking, reviewed, knownAddresses, isListed])

    const hasListedAddress = flaggedAddresses.some(
        ({ assessment }) => assessment.kind === 'listed',
    )
    const isHardBlockEnabled = useIsListedAddressHardBlockEnabled()
    const isListedAddressBlocking = hasListedAddress && isHardBlockEnabled
    const isAcknowledged =
        !!currentRequest && acknowledgedRequestId === currentRequest.id
    const toggleAcknowledged = useCallback(() => {
        if (!currentRequest) return
        setAcknowledgedRequestId(isAcknowledged ? undefined : currentRequest.id)
    }, [currentRequest, isAcknowledged, setAcknowledgedRequestId])

    return {
        flaggedAddresses,
        scope,
        isChecking,
        hasListedAddress,
        isListedAddressBlocking,
        isAcknowledged,
        toggleAcknowledged,
        isConfirmBlocked:
            isChecking ||
            isListedAddressBlocking ||
            (flaggedAddresses.length > 0 && !isAcknowledged),
    }
}
