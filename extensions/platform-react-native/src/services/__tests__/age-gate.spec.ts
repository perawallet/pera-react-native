import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NativeModules, Platform } from 'react-native'
import { mapNativeAgeResult, RNAgeGateService } from '../age-gate'

describe('mapNativeAgeResult — iOS', () => {
    it('maps a shared range with lowerBound >= 18 to adult', () => {
        const result = mapNativeAgeResult(
            { status: 'sharing', lowerBound: 18, upperBound: null },
            'ios',
        )
        expect(result).toEqual({ status: 'adult', source: 'platform' })
    })

    it('maps a shared range with upperBound < 18 to minor', () => {
        const result = mapNativeAgeResult(
            { status: 'sharing', lowerBound: 13, upperBound: 17 },
            'ios',
        )
        expect(result).toEqual({ status: 'minor', source: 'platform' })
    })

    it('maps declined sharing to unknown', () => {
        const result = mapNativeAgeResult({ status: 'declined' }, 'ios')
        expect(result).toEqual({ status: 'unknown', source: 'platform' })
    })

    it('maps an ambiguous range (no bounds) to unknown', () => {
        const result = mapNativeAgeResult(
            { status: 'sharing', lowerBound: null, upperBound: null },
            'ios',
        )
        expect(result).toEqual({ status: 'unknown', source: 'platform' })
    })
})

describe('mapNativeAgeResult — Android', () => {
    it('maps ageLower >= 18 to adult', () => {
        const result = mapNativeAgeResult(
            { userStatus: 'VERIFIED', ageLower: 18, ageUpper: null },
            'android',
        )
        expect(result).toEqual({ status: 'adult', source: 'platform' })
    })

    it('maps ageUpper < 18 to minor', () => {
        const result = mapNativeAgeResult(
            { userStatus: 'VERIFIED', ageLower: 16, ageUpper: 17 },
            'android',
        )
        expect(result).toEqual({ status: 'minor', source: 'platform' })
    })

    it('maps SUPERVISED_APPROVAL_DENIED to minor', () => {
        const result = mapNativeAgeResult(
            {
                userStatus: 'SUPERVISED_APPROVAL_DENIED',
                ageLower: null,
                ageUpper: null,
            },
            'android',
        )
        expect(result).toEqual({ status: 'minor', source: 'platform' })
    })

    it('maps null/unknown to unknown', () => {
        expect(
            mapNativeAgeResult(
                { userStatus: null, ageLower: null, ageUpper: null },
                'android',
            ),
        ).toEqual({ status: 'unknown', source: 'platform' })
        expect(
            mapNativeAgeResult(
                { userStatus: 'UNKNOWN', ageLower: null, ageUpper: null },
                'android',
            ),
        ).toEqual({ status: 'unknown', source: 'platform' })
    })
})

describe('RNAgeGateService', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        Platform.OS = 'ios'
        ;(NativeModules as Record<string, unknown>).PeraAgeGate = undefined
    })

    it('returns unknown when the native module is absent', async () => {
        const service = new RNAgeGateService()
        await expect(service.requestAgeRange(18)).resolves.toEqual({
            status: 'unknown',
            source: 'platform',
        })
    })

    it('returns manual capability when the native module is absent', async () => {
        const service = new RNAgeGateService()
        await expect(service.getDeviceCapability()).resolves.toBe('manual')
    })

    it('normalizes a native iOS adult result', async () => {
        ;(NativeModules as Record<string, unknown>).PeraAgeGate = {
            requestAgeRange: vi
                .fn()
                .mockResolvedValue({ status: 'sharing', lowerBound: 18 }),
            getDeviceCapability: vi.fn().mockResolvedValue('platform'),
        }
        const service = new RNAgeGateService()
        await expect(service.requestAgeRange(18)).resolves.toEqual({
            status: 'adult',
            source: 'platform',
        })
        await expect(service.getDeviceCapability()).resolves.toBe('platform')
    })

    it('returns unknown when the native call throws', async () => {
        ;(NativeModules as Record<string, unknown>).PeraAgeGate = {
            requestAgeRange: vi.fn().mockRejectedValue(new Error('boom')),
            getDeviceCapability: vi.fn().mockResolvedValue('platform'),
        }
        const service = new RNAgeGateService()
        await expect(service.requestAgeRange(18)).resolves.toEqual({
            status: 'unknown',
            source: 'platform',
        })
    })

    it('returns manual when getDeviceCapability throws', async () => {
        ;(NativeModules as Record<string, unknown>).PeraAgeGate = {
            requestAgeRange: vi
                .fn()
                .mockResolvedValue({ status: 'sharing', lowerBound: 18 }),
            getDeviceCapability: vi.fn().mockRejectedValue(new Error('boom')),
        }
        const service = new RNAgeGateService()
        await expect(service.getDeviceCapability()).resolves.toBe('manual')
    })
})
