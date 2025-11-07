import { container } from 'tsyringe'

export const KeyValueStorageServiceContainerKey = 'KeyValueStorageService'

export const SecureStorageServiceContainerKey = 'SecureStorageService'

export interface KeyValueStorageService {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
    removeItem(key: string): void
    setJSON<T>(key: string, value: T): void
    getJSON<T>(key: string): T | null
}

export interface SecureStorageService {
    setItem(key: string, value: Buffer): Promise<void>
    getItem(key: string): Promise<Buffer | null>
    removeItem(key: string): Promise<void>
    authenticate(): Promise<boolean>
}

export const useKeyValueStorageService = () =>
    container.resolve<KeyValueStorageService>(
        KeyValueStorageServiceContainerKey,
    )

export const useSecureStorageService = () =>
    container.resolve<SecureStorageService>(SecureStorageServiceContainerKey)
