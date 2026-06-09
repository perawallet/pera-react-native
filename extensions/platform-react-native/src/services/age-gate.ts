import { NativeModules, Platform } from 'react-native'
import { logger } from '@perawallet/wallet-core-shared'
import { ADULT_AGE } from '@perawallet/wallet-extension-platform'
import type {
    AgeGateDeviceCapability,
    AgeGateResult,
    AgeGateService,
} from '@perawallet/wallet-extension-platform'

export type RawIosAgeResult = {
    status: 'sharing' | 'declined' | 'unknown'
    lowerBound?: number | null
    upperBound?: number | null
}

export type RawAndroidAgeResult = {
    userStatus?: string | null
    ageLower?: number | null
    ageUpper?: number | null
}

export type RawNativeAgeResult = RawIosAgeResult | RawAndroidAgeResult

// The cast is safe because the only caller (RNAgeGateService) passes the payload
// from the matching platform's native module alongside its own Platform.OS.
// Bounds are always interpreted against the fixed 18 gate the native call requests.
export const mapNativeAgeResult = (
    raw: RawNativeAgeResult,
    platform: 'ios' | 'android',
): AgeGateResult => {
    const status =
        platform === 'ios'
            ? mapIos(raw as RawIosAgeResult)
            : mapAndroid(raw as RawAndroidAgeResult)
    return { status, source: 'platform' }
}

const mapIos = (raw: RawIosAgeResult): AgeGateResult['status'] => {
    if (raw.status !== 'sharing') return 'unknown'
    if (typeof raw.lowerBound === 'number' && raw.lowerBound >= ADULT_AGE) {
        return 'adult'
    }
    if (typeof raw.upperBound === 'number' && raw.upperBound < ADULT_AGE) {
        return 'minor'
    }
    return 'unknown'
}

const mapAndroid = (raw: RawAndroidAgeResult): AgeGateResult['status'] => {
    if (raw.userStatus === 'SUPERVISED_APPROVAL_DENIED') return 'minor'
    if (typeof raw.ageLower === 'number' && raw.ageLower >= ADULT_AGE) {
        return 'adult'
    }
    if (typeof raw.ageUpper === 'number' && raw.ageUpper < ADULT_AGE) {
        return 'minor'
    }
    return 'unknown'
}

const LOG_SOURCE = 'RNAgeGateService'

interface NativePeraAgeGate {
    requestAgeRange(minimumAge: number): Promise<RawNativeAgeResult>
    getDeviceCapability(): Promise<AgeGateDeviceCapability>
}

const getNativeModule = (): NativePeraAgeGate | null => {
    const module = (
        NativeModules as Record<string, NativePeraAgeGate | undefined>
    ).PeraAgeGate
    return module ?? null
}

export class RNAgeGateService implements AgeGateService {
    async requestAgeRange(minimumAge: number): Promise<AgeGateResult> {
        const module = getNativeModule()
        if (!module) {
            return { status: 'unknown', source: 'platform' }
        }
        try {
            const raw = await module.requestAgeRange(minimumAge)
            return mapNativeAgeResult(
                raw,
                Platform.OS === 'ios' ? 'ios' : 'android',
            )
        } catch (error) {
            logger.warn('requestAgeRange native call threw', {
                source: LOG_SOURCE,
                minimumAge,
                error,
            })
            return { status: 'unknown', source: 'platform' }
        }
    }

    async getDeviceCapability(): Promise<AgeGateDeviceCapability> {
        const module = getNativeModule()
        if (!module) return 'manual'
        try {
            return await module.getDeviceCapability()
        } catch (error) {
            logger.warn('getDeviceCapability native call threw', {
                source: LOG_SOURCE,
                error,
            })
            return 'manual'
        }
    }
}
