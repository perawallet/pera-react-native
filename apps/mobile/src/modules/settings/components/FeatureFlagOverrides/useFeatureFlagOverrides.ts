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
    RemoteConfigDefaults,
    RemoteConfigKeys,
    useRemoteConfigOverrides,
} from '@perawallet/wallet-core-remote-config'
import { useMemo } from 'react'

export const useFeatureFlagOverrides = () => {
    const { configOverrides, setConfigOverride } = useRemoteConfigOverrides()

    // Booleans get a toggle, strings a text field. Number-valued keys
    // (e.g. thresholds) still have no editor and stay hidden.
    const booleanFlagKeys = useMemo(() => {
        const defaults = RemoteConfigDefaults as Record<string, unknown>
        return Object.keys(RemoteConfigKeys).filter(
            key => typeof defaults[key] === 'boolean',
        )
    }, [])

    const stringFlagKeys = useMemo(() => {
        const defaults = RemoteConfigDefaults as Record<string, unknown>
        return Object.keys(RemoteConfigKeys).filter(
            key => typeof defaults[key] === 'string',
        )
    }, [])

    // An empty field means "no override", not "override with empty string" —
    // otherwise clearing the box would gate every locale off rather than
    // handing the key back to the real remote config value.
    const setStringOverride = (key: string, value: string) => {
        setConfigOverride(key, value === '' ? null : value)
    }

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
        stringFlagKeys,
        setStringOverride,
        expanded,
        toggleExpand,
        toggleOverride,
        prettifyKey,
    }
}
