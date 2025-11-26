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

export class MemoryKeyValueStorage implements KeyValueStorageService {
    private storage: Record<string, string> = {}

    getItem(key: string): string | null {
        return this.storage[key] ?? null
    }

    setItem(key: string, value: string): void {
        this.storage[key] = value
    }

    removeItem(key: string): void {
        delete this.storage[key]
    }

    setJSON<T>(key: string, value: T): void {
        this.storage[key] = JSON.stringify(value)
    }

    getJSON<T>(key: string): T | null {
        const value = this.storage[key]
        return value ? JSON.parse(value) : null
    }
}
