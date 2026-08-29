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

import { useCallback } from 'react'
import {
    RemoteConfigKeys,
    useRemoteConfig,
} from '@perawallet/wallet-core-remote-config'
import { useSettingsStore } from '@perawallet/wallet-core-settings'

/** Persisted key (settings `preferences` bag) for the last accepted T&C version. */
export const ACCEPTED_TERMS_VERSION_KEY = 'acceptedTermsVersion'

/**
 * Fallback while remote config is unresolved. Empty on purpose: the
 * `currentVersion !== ''` guard below then holds the gate closed until a real
 * version activates. A placeholder here reads as a genuine version, so the user
 * accepts it, the real value activates moments later and the gate fires a
 * second time, showing duplicate T&Cs, worst on a first launch after
 * migration when the config cache is cold.
 *
 * Consequence: if `terms_version` is never set in remote config, the gate never
 * fires. There is no in-repo default to fall back on.
 */
const DEFAULT_TERMS_VERSION = ''

export type UseTermsAcceptanceResult = {
    /** The current required T&C version from remote config. */
    currentVersion: string
    /**
     * True when the user has not yet accepted the current T&C version — either a
     * first launch or because the version was bumped after their last
     * acceptance.
     */
    needsAcceptance: boolean
    /** Persist the current version as accepted. */
    acceptCurrentTerms: () => void
}

/**
 * Drives the Terms & Conditions acceptance gate. The required version comes from
 * remote config (`terms_version`); the last version the user accepted is
 * persisted on disk via the settings store. When they differ, the user must
 * accept again — bumping `terms_version` re-prompts everyone.
 */
export const useTermsAcceptance = (): UseTermsAcceptanceResult => {
    const remoteConfig = useRemoteConfig()
    const currentVersion = remoteConfig.getStringValue(
        RemoteConfigKeys.terms_version,
        DEFAULT_TERMS_VERSION,
    )

    const acceptedVersion = useSettingsStore(
        state => state.preferences[ACCEPTED_TERMS_VERSION_KEY],
    )
    const setPreference = useSettingsStore(state => state.setPreference)

    const acceptCurrentTerms = useCallback(() => {
        setPreference(ACCEPTED_TERMS_VERSION_KEY, currentVersion)
    }, [setPreference, currentVersion])

    return {
        currentVersion,
        // Only gate when a version is actually known — never block the user
        // behind an empty/unavailable terms version.
        needsAcceptance:
            currentVersion !== '' && acceptedVersion !== currentVersion,
        acceptCurrentTerms,
    }
}
