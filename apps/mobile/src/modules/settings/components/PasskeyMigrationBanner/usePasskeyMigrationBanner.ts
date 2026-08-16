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

import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { subtle } from 'react-native-quick-crypto'
import {
    passkeysQueryKeyRoot,
    readFlaggedPasskeyCredentials,
    usePasskeysQuery,
    type Passkey,
} from '@perawallet/wallet-core-passkeys'

export type UsePasskeyMigrationBannerParams = {
    /**
     * Whether the screen is showing the managed-passkey content, the same gate
     * the prerequisite callouts use — false while loading, errored, or
     * provider-disabled with nothing to list.
     */
    isManaging: boolean
    /**
     * Whether Pera is the OS's active credential provider. Not implied by
     * `isManaging`: a screen with passkeys to show resolves to `populated`
     * whatever the provider reports.
     */
    isProviderActive: boolean
    /** The screen's confirm-then-delete flow. Never bypassed. */
    onRequestDelete: (passkey: Passkey) => void
}

export type UsePasskeyMigrationBannerResult = {
    affected: Passkey[]
    isVisible: boolean
    /**
     * Whether to offer delete-and-recreate. The warning stands on its own, but
     * the action is one-way — with the provider switched off the credential
     * would be gone and the replacement unregisterable.
     */
    canRecreate: boolean
    onRecreate: (passkey: Passkey) => void
    onDismiss: () => void
}

// Built from the shared root because `useRemovePasskeyMutation` invalidates
// that root and TanStack matches by prefix — a key outside it would leave the
// banner listing a credential the user just deleted.
const flaggedPasskeysQueryKey = [
    ...passkeysQueryKeyRoot,
    'needs-migration',
] as const

/**
 * The two places a `needs-migration` marker can still be read, unioned:
 *
 * - the flat bare-id provider records, which is where all but one case lands —
 *   `repairs/0002-rematerialize-passkey-credentials` deletes the `k/` record
 *   upstream stamped, so these credentials are absent from the reactive
 *   keystore store and hence from `usePasskeysQuery`'s keystore projection;
 * - `usePasskeysQuery` itself, for a credential that repair declined to
 *   un-adopt and whose `k/` record therefore survives.
 */
export const usePasskeyMigrationBanner = ({
    isManaging,
    isProviderActive,
    onRequestDelete,
}: UsePasskeyMigrationBannerParams): UsePasskeyMigrationBannerResult => {
    const { passkeys } = usePasskeysQuery()
    const [isDismissed, setIsDismissed] = useState(false)

    const flaggedQuery = useQuery({
        queryKey: flaggedPasskeysQueryKey,
        queryFn: () =>
            readFlaggedPasskeyCredentials({
                subtle: subtle as unknown as SubtleCrypto,
            }),
        staleTime: 30_000,
    })

    const affected = useMemo(() => {
        const byKeyId = new Map<string, Passkey>()
        for (const candidate of [
            ...passkeys.filter(p => p.needsMigration),
            ...(flaggedQuery.data ?? []),
        ]) {
            if (!byKeyId.has(candidate.keyId))
                byKeyId.set(candidate.keyId, candidate)
        }
        return [...byKeyId.values()]
    }, [passkeys, flaggedQuery.data])

    const onDismiss = useCallback(() => setIsDismissed(true), [])

    return {
        affected,
        isVisible: isManaging && !isDismissed && affected.length > 0,
        canRecreate: isProviderActive,
        onRecreate: onRequestDelete,
        onDismiss,
    }
}
