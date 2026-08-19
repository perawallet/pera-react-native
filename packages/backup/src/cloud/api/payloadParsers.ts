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

import {
    BackupAccountType,
    type AddressBackupPayload,
    type BackupHardwareTransportType,
    type SecretsBackupPayload,
} from '../models'

export class BackupPayloadParseError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'BackupPayloadParseError'
    }
}

const parseJson = (raw: string): Record<string, unknown> => {
    try {
        const value = JSON.parse(raw)
        if (typeof value !== 'object' || value === null) {
            throw new BackupPayloadParseError('Payload is not an object')
        }
        return value as Record<string, unknown>
    } catch (error) {
        if (error instanceof BackupPayloadParseError) throw error
        const detail = error instanceof Error ? `: ${error.message}` : ''
        throw new BackupPayloadParseError(`Payload is not valid JSON${detail}`)
    }
}

const requireString = (o: Record<string, unknown>, field: string): string => {
    const value = o[field]
    if (typeof value !== 'string') {
        throw new BackupPayloadParseError(
            `Invalid or missing string field: ${field}`,
        )
    }
    return value
}

const requireNonNegativeInteger = (
    o: Record<string, unknown>,
    field: string,
): number => {
    const value = o[field]
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        throw new BackupPayloadParseError(
            `Invalid or missing non-negative integer field: ${field}`,
        )
    }
    return value
}

const requireStringArray = (
    o: Record<string, unknown>,
    field: string,
): string[] => {
    const value = o[field]
    if (
        !Array.isArray(value) ||
        !value.every(item => typeof item === 'string')
    ) {
        throw new BackupPayloadParseError(
            `Invalid or missing string[] field: ${field}`,
        )
    }
    return value as string[]
}

const requireHardwareTransportType = (
    o: Record<string, unknown>,
    field: string,
): BackupHardwareTransportType => {
    const value = o[field]
    if (value !== 'ble' && value !== 'usb') {
        throw new BackupPayloadParseError(
            `Invalid or missing hardware transport type field: ${field}`,
        )
    }
    return value
}

const optionalName = (o: Record<string, unknown>): string | null =>
    typeof o.customName === 'string' ? o.customName : null

export const parseAddressPayload = (raw: string): AddressBackupPayload => {
    const o = parseJson(raw)
    const type = o.type
    switch (type) {
        case BackupAccountType.algo25: {
            return {
                type,
                address: requireString(o, 'address'),
                customName: optionalName(o),
            }
        }
        case BackupAccountType.hdSeed: {
            return { type, address: requireString(o, 'address') }
        }
        case BackupAccountType.hdWallet: {
            return {
                type,
                address: requireString(o, 'address'),
                seedFirstDerivedAddress: requireString(
                    o,
                    'seedFirstDerivedAddress',
                ),
                publicKey: requireString(o, 'publicKey'),
                account: requireNonNegativeInteger(o, 'account'),
                change: requireNonNegativeInteger(o, 'change'),
                keyIndex: requireNonNegativeInteger(o, 'keyIndex'),
                derivationType: requireNonNegativeInteger(o, 'derivationType'),
                customName: optionalName(o),
            }
        }
        case BackupAccountType.hardware: {
            return {
                type,
                address: requireString(o, 'address'),
                deviceId: requireString(o, 'deviceId'),
                deviceName: requireString(o, 'deviceName'),
                accountIndex: requireNonNegativeInteger(o, 'accountIndex'),
                manufacturer: requireString(o, 'manufacturer'),
                transportType: requireHardwareTransportType(o, 'transportType'),
                customName: optionalName(o),
            }
        }
        case BackupAccountType.watch: {
            return {
                type,
                address: requireString(o, 'address'),
                customName: optionalName(o),
            }
        }
        case BackupAccountType.multisig: {
            return {
                type,
                address: requireString(o, 'address'),
                participantAddresses: requireStringArray(
                    o,
                    'participantAddresses',
                ),
                threshold: requireNonNegativeInteger(o, 'threshold'),
                version: requireNonNegativeInteger(o, 'version'),
                customName: optionalName(o),
            }
        }
        case BackupAccountType.quantum: {
            return {
                type,
                address: requireString(o, 'address'),
                customName: optionalName(o),
            }
        }
        default: {
            throw new BackupPayloadParseError(
                `Unknown account payload type: ${String(type)}`,
            )
        }
    }
}

export const parseSecretsPayload = (raw: string): SecretsBackupPayload => {
    const o = parseJson(raw)
    const type = o.type
    switch (type) {
        case BackupAccountType.algo25: {
            return { type, mnemonic: requireString(o, 'mnemonic') }
        }
        case BackupAccountType.hdSeed: {
            return {
                type,
                seed: requireString(o, 'seed'),
                entropy: requireString(o, 'entropy'),
            }
        }
        case BackupAccountType.quantum: {
            return { type, mnemonic: requireString(o, 'mnemonic') }
        }
        default: {
            throw new BackupPayloadParseError(
                `Unknown secrets payload type: ${String(type)}`,
            )
        }
    }
}
