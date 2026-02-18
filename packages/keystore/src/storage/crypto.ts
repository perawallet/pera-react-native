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

import * as Keychain from 'react-native-keychain'
import {
    createCipheriv,
    createDecipheriv,
    randomBytes,
} from 'react-native-quick-crypto'

const ALGORITHM = 'aes-256-gcm'

/**
 * Retrieves the master key from the Keychain, or generates a new one if it doesn't exist.
 * @returns The master key as a Buffer
 */
export async function getMasterKey(): Promise<Buffer> {
    const credentials = await Keychain.getGenericPassword({
        service: 'app-secret',
    })
    if (credentials) {
        return Buffer.from(credentials.password, 'hex')
    }

    // Create new random key
    const newKey = randomBytes(32)
    await Keychain.setGenericPassword('master', newKey.toString('hex'), {
        service: 'app-secret',
    })

    //@ts-expect-error, this should be fine
    return newKey
}

/**
 * Encrypts data using AES-256-GCM with the provided key.
 * @param key - The encryption key
 * @param data - The string data to encrypt
 * @returns A JSON string containing IV, Auth Tag, and encrypted content
 */
export const encryptData = (key: Buffer, data: string): string => {
    const iv = randomBytes(12) // 96-bit IV for GCM
    const cipher = createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(data, 'utf8', 'base64')
    encrypted += cipher.final('base64')
    const authTag = cipher.getAuthTag()

    // Return a combined payload
    return JSON.stringify({
        iv: iv.toString('base64'),
        tag: authTag.toString('base64'),
        content: encrypted,
    })
}

/**
 * Decrypts data using AES-256-GCM with the provided key and payload.
 * @param key - The decryption key
 * @param payloadStr - The JSON string containing IV, Auth Tag, and content
 * @returns The decrypted string
 */
export const decryptData = (key: Buffer, payloadStr: string): string => {
    const { iv, tag, content } = JSON.parse(payloadStr)

    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64'))

    //@ts-expect-error, this is fine
    decipher.setAuthTag(Buffer.from(tag, 'base64'))

    let decrypted = decipher.update(content, 'base64', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
}
