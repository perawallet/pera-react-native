import { requireOptionalNativeModule } from 'expo'

export type PeraBiometricBindingStatus =
    | 'valid'
    | 'changed'
    | 'absent'
    | 'unavailable'

export type PeraBiometricBindingModule = {
    /** Resolves false when the current enrollment could not be recorded. */
    createBinding(): Promise<boolean>
    checkBinding(): Promise<PeraBiometricBindingStatus>
    clearBinding(): Promise<void>
}

export const PeraBiometricBinding =
    requireOptionalNativeModule<PeraBiometricBindingModule>(
        'PeraBiometricBinding',
    )
