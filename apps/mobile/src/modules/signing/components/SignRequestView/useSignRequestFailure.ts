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

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { RekeyTargetNotFoundError } from '@perawallet/wallet-core-accounts'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { config } from '@perawallet/wallet-core-config'
import { useDeviceID } from '@perawallet/wallet-core-device'
import {
    getSignRequestDetailQueryKey,
    useSignRequestDetailQuery,
    type SignRequestStatus,
} from '@perawallet/wallet-core-multisig'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { SignRequest } from '@perawallet/wallet-core-signing'
import { useLanguage } from '@hooks/useLanguage'

export type UseSignRequestFailureResult = {
    /**
     * True while the request's current status is being re-read from the
     * backend. The caller shows a spinner instead of the copy below, so a
     * cosign rejected by an already-resolved request doesn't flash the
     * generic failure text and then correct itself.
     */
    isResolving: boolean
    /** Fully resolved, ready-to-render — never pass these through t() again. */
    title: string
    body: string
}

/**
 * Copy for a cosign that was rejected because the request had already been
 * resolved elsewhere. `failed` is deliberately absent: a request whose
 * broadcast genuinely failed is a failure, not "another signer got there
 * first", so it keeps the generic copy.
 */
const ALREADY_RESOLVED_COPY: Partial<
    Record<SignRequestStatus, { title: string; body: string }>
> = {
    confirmed: {
        title: 'multisig.already_resolved.confirmed.title',
        body: 'multisig.already_resolved.confirmed.body',
    },
    declined: {
        title: 'multisig.already_resolved.declined.title',
        body: 'multisig.already_resolved.declined.body',
    },
    expired: {
        title: 'multisig.already_resolved.expired.title',
        body: 'multisig.already_resolved.expired.body',
    },
}

/**
 * Resolves what to show when a sign request fails.
 *
 * The multisig case needs a round-trip: the backend rejects a cosign for an
 * already-resolved request without saying which of confirmed/declined/expired
 * applies, and the cosign transport flattens every failure into a generic
 * `TransportError` anyway. So on failure we re-read the request and key the
 * copy off its status.
 *
 * The re-read must be forced. The pending-signatures sheet polls this same
 * query every 5s, so under the global 60s staleTime the cached status is
 * fresh-but-wrong at exactly the moment another device finalizes the request.
 * Invalidating also refreshes the sheet's own observer, which is what drops
 * its Sign button once the terminal status lands.
 */
export const useSignRequestFailure = (
    request: SignRequest,
    error: Nullable<Error>,
): UseSignRequestFailureResult => {
    const { t } = useLanguage()
    const { network } = useNetwork()
    const deviceId = useDeviceID(network) ?? ''
    const queryClient = useQueryClient()

    const cosignSignRequestId =
        error && request.sourceType === 'multisig-cosign'
            ? (request.signRequestId ?? null)
            : null

    // Keyed by request id rather than a plain boolean so a second failure for
    // a different request re-enters the resolving state instead of reusing the
    // previous verdict.
    const [settledSignRequestId, setSettledSignRequestId] =
        useState<Nullable<string>>(null)

    useEffect(() => {
        if (!cosignSignRequestId) return
        let isCancelled = false
        void queryClient
            .invalidateQueries({
                queryKey: getSignRequestDetailQueryKey(
                    network,
                    cosignSignRequestId,
                ),
            })
            .finally(() => {
                if (!isCancelled) {
                    setSettledSignRequestId(cosignSignRequestId)
                }
            })
        return () => {
            isCancelled = true
        }
    }, [cosignSignRequestId, network, queryClient])

    const { data: signRequest } = useSignRequestDetailQuery({
        network,
        deviceId,
        signRequestId: cosignSignRequestId ?? '',
        enabled: cosignSignRequestId !== null && deviceId !== '',
    })

    const isResolving =
        cosignSignRequestId !== null &&
        settledSignRequestId !== cosignSignRequestId

    const alreadyResolved =
        !isResolving && signRequest
            ? ALREADY_RESOLVED_COPY[signRequest.status]
            : undefined

    if (alreadyResolved) {
        return {
            isResolving: false,
            title: t(alreadyResolved.title),
            body: t(alreadyResolved.body),
        }
    }

    return {
        isResolving,
        title: t('signing.signing_failed.title'),
        body: resolveFailureBody(t, error),
    }
}

const resolveFailureBody = (
    t: (key: string, params?: Record<string, string>) => string,
    error: Nullable<Error>,
): string => {
    if (config.debugEnabled && error?.message) return error.message

    // Backstop for a rekeyed-to-external sender that slipped past the up-front
    // gate (useSigningActionButtons) and failed at machine init — explain the
    // rekey state instead of the generic failure copy.
    if (error instanceof RekeyTargetNotFoundError) {
        return t('signing.cannot_sign.rekeyed_auth_missing_body', {
            authAddress: String(error.metadata.params?.rekeyAddress ?? ''),
        })
    }

    return t('signing.signing_failed.body')
}
