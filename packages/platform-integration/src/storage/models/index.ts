/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

/**
 * Interface for a key-value storage service with support for JSON objects.
 */
export interface KeyValueStorageService {
    /** Retrieves a string item from storage */
    getItem(key: string): string | null
    /** Sets a string item in storage */
    setItem(key: string, value: string): void
    /** Removes an item from storage */
    removeItem(key: string): void
    /** Encodes and sets a JSON object in storage */
    setJSON<T>(key: string, value: T): void
    /** Retrieves and decodes a JSON object from storage */
    getJSON<T>(key: string): T | null
    /** Retrieves all keys present in the storage */
    getAllKeys(): string[]
}

/**
 * Interface for a secure storage service for sensitive data (e.g., keys, secrets).
 * May require hardware authentication (biometrics/pin).
 */
export interface SecureStorageService {
    /** Encrypts and sets sensitive data in secure storage */
    setItem(key: string, value: Uint8Array): Promise<void>
    /** Decrypts and retrieves sensitive data from secure storage */
    getItem(key: string): Promise<Uint8Array | null>
    /** Removes an item from secure storage */
    removeItem(key: string): Promise<void>
    /** Triggers hardware authentication for access to secure storage */
    authenticate(): Promise<boolean>
}
