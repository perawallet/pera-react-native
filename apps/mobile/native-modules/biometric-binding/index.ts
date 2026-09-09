import { requireOptionalNativeModule } from 'expo'

export type PeraBiometricBindingStatus =
    | 'valid'
    | 'changed'
    | 'absent'
    | 'unavailable'

export type PeraBiometricAvailability =
    | 'available'
    | 'none-enrolled'
    | 'denied'
    | 'unavailable'
    | 'unknown'

export type PeraBiometricBindingModule = {
    /** Resolves null when no OS-bound key could be created. */
    armBinding(): Promise<{ blob: string; tokenHash: string } | null>
    unwrapToken(
        blob: string,
        prompt: { title: string; cancelLabel: string },
    ): Promise<Uint8Array>
    checkBinding(): Promise<PeraBiometricBindingStatus>
    clearBinding(): Promise<void>
    /** The raw platform status behind "biometrics unavailable". */
    getAvailability(): Promise<PeraBiometricAvailability>
}

export const PeraBiometricBinding =
    requireOptionalNativeModule<PeraBiometricBindingModule>(
        'PeraBiometricBinding',
    )
