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

import { beforeEach, describe, expect, it, vi } from 'vitest'

// getDeviceCapability is part of the AgeGateService contract but the
// orchestration deliberately never calls it — a manual-capability device
// surfaces as requestAgeRange → 'unknown' → needs-declaration.
const ageGate = {
    requestAgeRange: vi.fn(),
    getDeviceCapability: vi.fn(),
}
const remoteConfig = { getBooleanValue: vi.fn() }
const storage = {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
}

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({ ageGate, remoteConfig, keyValueStorage: storage }),
}))

import { resolveAgeGate, applyDeclaration } from '../resolveAgeGate'
import { useAgeGateStore } from '../../store'

describe('resolveAgeGate', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useAgeGateStore.getState().resetState()
        remoteConfig.getBooleanValue.mockReturnValue(false)
    })

    it('returns a cached adult decision without re-querying', async () => {
        useAgeGateStore.getState().setDecision('adult', 'platform')
        const result = await resolveAgeGate()
        expect(result).toEqual({ kind: 'resolved', status: 'adult' })
        expect(ageGate.requestAgeRange).not.toHaveBeenCalled()
    })

    it('returns a cached minor decision without re-querying', async () => {
        useAgeGateStore.getState().setDecision('minor', 'self-declared')
        const result = await resolveAgeGate()
        expect(result).toEqual({ kind: 'resolved', status: 'minor' })
        expect(ageGate.requestAgeRange).not.toHaveBeenCalled()
    })

    it('caches and returns a platform adult result', async () => {
        ageGate.requestAgeRange.mockResolvedValue({
            status: 'adult',
            source: 'platform',
        })
        const result = await resolveAgeGate()
        expect(result).toEqual({ kind: 'resolved', status: 'adult' })
        expect(useAgeGateStore.getState().status).toBe('adult')
    })

    it('caches and returns a platform minor result', async () => {
        ageGate.requestAgeRange.mockResolvedValue({
            status: 'minor',
            source: 'platform',
        })
        const result = await resolveAgeGate()
        expect(result).toEqual({ kind: 'resolved', status: 'minor' })
        expect(useAgeGateStore.getState().status).toBe('minor')
    })

    it('signals needs-declaration when platform is unknown and force_platform_age_gate is false', async () => {
        ageGate.requestAgeRange.mockResolvedValue({
            status: 'unknown',
            source: 'platform',
        })
        const result = await resolveAgeGate()
        expect(result).toEqual({ kind: 'needs-declaration' })
        expect(useAgeGateStore.getState().status).toBeNull()
    })

    it('treats platform unknown as minor when force_platform_age_gate is true', async () => {
        ageGate.requestAgeRange.mockResolvedValue({
            status: 'unknown',
            source: 'platform',
        })
        remoteConfig.getBooleanValue.mockReturnValue(true)
        const result = await resolveAgeGate()
        expect(result).toEqual({ kind: 'resolved', status: 'minor' })
        expect(useAgeGateStore.getState().status).toBe('minor')
    })

    it('force re-runs even when a minor decision is cached', async () => {
        useAgeGateStore.getState().setDecision('minor', 'self-declared')
        ageGate.requestAgeRange.mockResolvedValue({
            status: 'adult',
            source: 'platform',
        })
        const result = await resolveAgeGate({ force: true })
        expect(result).toEqual({ kind: 'resolved', status: 'adult' })
        expect(useAgeGateStore.getState().status).toBe('adult')
    })
})

describe('applyDeclaration', () => {
    beforeEach(() => useAgeGateStore.getState().resetState())

    it('caches adult on a yes', () => {
        expect(applyDeclaration(true)).toBe('adult')
        expect(useAgeGateStore.getState().status).toBe('adult')
        expect(useAgeGateStore.getState().source).toBe('self-declared')
    })

    it('caches minor on a no', () => {
        expect(applyDeclaration(false)).toBe('minor')
        expect(useAgeGateStore.getState().status).toBe('minor')
        expect(useAgeGateStore.getState().source).toBe('self-declared')
    })
})
