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
import {
    useFlaggedPasskeysQuery,
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
    /**
     * Whether the flat-record read actually examined every record. Not merely
     * "has resolved": `readFlaggedPasskeyCredentials` catches an unreadable
     * key listing, an unreadable master key and an unopenable record alike and
     * *resolves* with an empty list, so a resolved read is compatible with
     * having learnt nothing. Until this is true, `affected` is not "nothing is
     * flagged" but "not known" — and a `source: 'native'` row carries no marker
     * of its own to fall back on, so a consumer gating a one-way action has to
     * withhold rather than guess.
     */
    isFlagSourceComplete: boolean
    onRecreate: (passkey: Passkey) => void
    onDismiss: () => void
}

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

    const { flaggedPasskeys, isComplete } = useFlaggedPasskeysQuery()

    // Keyed on `id`, the url-safe-normalised credential id `mergePasskeys`
    // also dedupes on — not on the raw `keyId`. Both native credential stores
    // carry a `credentialIdCandidates` normaliser because the same credential's
    // raw id has been persisted in both standard and url-safe base64, so a
    // keyId-join would list one credential twice.
    const affected = useMemo(() => {
        const byId = new Map<string, Passkey>()
        for (const candidate of [
            ...passkeys.filter(p => p.needsMigration),
            ...flaggedPasskeys,
        ]) {
            if (!byId.has(candidate.id)) byId.set(candidate.id, candidate)
        }
        return [...byId.values()]
    }, [passkeys, flaggedPasskeys])

    const onDismiss = useCallback(() => setIsDismissed(true), [])

    return {
        affected,
        isVisible: isManaging && !isDismissed && affected.length > 0,
        canRecreate: isProviderActive,
        isFlagSourceComplete: isComplete,
        onRecreate: onRequestDelete,
        onDismiss,
    }
}
