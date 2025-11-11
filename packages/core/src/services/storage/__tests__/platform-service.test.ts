import { describe, test, expect, vi } from 'vitest'
import { container } from 'tsyringe'
import {
    KeyValueStorageServiceContainerKey,
    SecureStorageServiceContainerKey,
    useKeyValueStorageService,
    useSecureStorageService,
    type KeyValueStorageService,
    type SecureStorageService,
} from '@services/storage'

describe('services/storage/platform-service', () => {
    test('useKeyValueStorageService resolves the registered KeyValueStorageService from the container', () => {
        class MemoryKeyValueStorage implements KeyValueStorageService {
            private store = new Map<string, string>()

            getItem(key: string): string | null {
                return this.store.get(key) ?? null
            }

            setItem(key: string, value: string): void {
                this.store.set(key, value)
            }

            removeItem(key: string): void {
                this.store.delete(key)
            }

            setJSON<T>(key: string, value: T): void {
                this.setItem(key, JSON.stringify(value))
            }

            getJSON<T>(key: string): T | null {
                const v = this.getItem(key)
                return v ? (JSON.parse(v) as T) : null
            }
        }

        const kv = new MemoryKeyValueStorage()
        container.register(KeyValueStorageServiceContainerKey, { useValue: kv })

        const svc = useKeyValueStorageService()
        expect(svc).toBe(kv)
    })

    test('useSecureStorageService resolves the registered SecureStorageService from the container', async () => {
        const dummy: SecureStorageService = {
            setItem: vi.fn(async (_k: string, _v: Buffer) => {}),
            getItem: vi.fn(async (_k: string) => null),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        container.register(SecureStorageServiceContainerKey, {
            useValue: dummy,
        })

        const svc = useSecureStorageService()
        expect(svc).toBe(dummy)
    })
})
