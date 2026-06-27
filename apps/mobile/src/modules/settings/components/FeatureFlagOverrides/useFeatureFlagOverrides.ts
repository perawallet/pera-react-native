/*
 Copyright 2022-2025 Pera Wallet, LDA
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
    RemoteConfigDefaults,
    RemoteConfigKeys,
    useRemoteConfigOverrides,
} from '@perawallet/wallet-core-remote-config'
import { useMemo } from 'react'

export const useFeatureFlagOverrides = () => {
    const { configOverrides, setConfigOverride } = useRemoteConfigOverrides()

    // This screen renders each flag as a boolean toggle, so only surface
    // remote-config values that are actually booleans. String/number values
    // (e.g. terms_version, thresholds) can't be toggled and are hidden here.
    const booleanFlagKeys = useMemo(
        () =>
            Object.keys(RemoteConfigKeys).filter(
                key => typeof RemoteConfigDefaults[key] === 'boolean',
            ),
        [],
    )

    const expanded = useMemo(
        () => Object.keys(configOverrides),
        [configOverrides],
    )

    const toggleExpand = (key: string) => {
        if (expanded.includes(key)) {
            setConfigOverride(key, null)
        } else {
            setConfigOverride(key, false)
        }
    }

    const toggleOverride = (key: string) => {
        const value = configOverrides[key]
        if (!value) {
            setConfigOverride(key, true)
        } else {
            setConfigOverride(key, false)
        }
    }

    const prettifyKey = (key: string) => {
        return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }

    return {
        configOverrides,
        setConfigOverride,
        booleanFlagKeys,
        expanded,
        toggleExpand,
        toggleOverride,
        prettifyKey,
    }
}
