import type { KeyValueStorageService } from '@services/storage'

export class MemoryKeyValueStorage implements KeyValueStorageService {
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

export const createMemoryKV = () => new MemoryKeyValueStorage()
