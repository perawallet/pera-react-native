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

import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    ADULT_AGE,
    RemoteConfigKeys,
} from '@perawallet/wallet-extension-platform'
import type { AgeGateStatus } from '../models'
import { useAgeGateStore } from '../store'

export type ResolveAgeGateResult =
    | { kind: 'resolved'; status: AgeGateStatus }
    | { kind: 'needs-declaration' }

export const resolveAgeGate = async (
    options: { force?: boolean } = {},
): Promise<ResolveAgeGateResult> => {
    const { ageGate, remoteConfig } = getProvider()

    const cached = useAgeGateStore.getState().status
    if (!options.force && (cached === 'adult' || cached === 'minor')) {
        return { kind: 'resolved', status: cached }
    }

    const result = await ageGate.requestAgeRange(ADULT_AGE)
    if (result.status === 'adult' || result.status === 'minor') {
        useAgeGateStore.getState().setDecision(result.status, 'platform')
        return { kind: 'resolved', status: result.status }
    }

    // Platform signal unavailable. In platform-strict jurisdictions we do NOT
    // accept self-attestation — treat as minor. Otherwise fall back to self-declare.
    const forcePlatform = remoteConfig.getBooleanValue(
        RemoteConfigKeys.force_platform_age_gate,
        false,
    )
    if (forcePlatform) {
        useAgeGateStore.getState().setDecision('minor', 'platform')
        return { kind: 'resolved', status: 'minor' }
    }

    return { kind: 'needs-declaration' }
}

export const applyDeclaration = (isAdult: boolean): AgeGateStatus => {
    const status: AgeGateStatus = isAdult ? 'adult' : 'minor'
    useAgeGateStore.getState().setDecision(status, 'self-declared')
    return status
}
