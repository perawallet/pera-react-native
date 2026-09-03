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
    /** Resolves false when the current enrollment could not be recorded. */
    createBinding(): Promise<boolean>
    checkBinding(): Promise<PeraBiometricBindingStatus>
    clearBinding(): Promise<void>
    /** The raw platform status behind "biometrics unavailable". */
    getAvailability(): Promise<PeraBiometricAvailability>
}

export const PeraBiometricBinding =
    requireOptionalNativeModule<PeraBiometricBindingModule>(
        'PeraBiometricBinding',
    )
