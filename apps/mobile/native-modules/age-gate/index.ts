import { requireOptionalNativeModule } from 'expo'

export type PeraAgeGateResult = {
    /** iOS: DeclaredAgeRange outcome. */
    status?: 'sharing' | 'declined' | 'unknown'
    lowerBound?: number | null
    upperBound?: number | null
    /** Android: Play Age Signals outcome. */
    userStatus?: string | null
    ageLower?: number | null
    ageUpper?: number | null
}

export type PeraAgeGateModule = {
    getDeviceCapability(): Promise<'platform' | 'manual'>
    requestAgeRange(minimumAge: number): Promise<PeraAgeGateResult>
}

export const PeraAgeGate =
    requireOptionalNativeModule<PeraAgeGateModule>('PeraAgeGate')
