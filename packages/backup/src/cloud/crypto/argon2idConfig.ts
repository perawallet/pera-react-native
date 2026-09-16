/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import type { Argon2idConfig } from '../models'

// Memory and parallelism size allocations and time multiplies the work, and
// every caller reads the block from input anyone can craft, so bound it
// before deriving.
const MAX_MEMORY_COST_MIB = 512
const MAX_TIME_COST = 10
const MAX_PARALLELISM = 4
// Every caller derives a 32-byte key (an aes-256-gcm key or the backup
// master key); another length only fails later, as a wrong code or bad
// credentials.
const REQUIRED_OUTPUT_LENGTH = 32
// Argon2's own floor is 8 bytes; this build generates 16.
const MIN_SALT_LENGTH = 8
const MAX_SALT_LENGTH = 64

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

export const isPositiveInteger = (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value > 0

/** Reads the snake_case block `serializeArgon2idConfig` writes; `null` when malformed. */
export const readArgon2idConfig = (value: unknown): Argon2idConfig | null => {
    if (!isRecord(value)) return null
    const { time_cost, memory_cost, parallelism, output_length } = value
    if (
        !isPositiveInteger(time_cost) ||
        !isPositiveInteger(memory_cost) ||
        !isPositiveInteger(parallelism) ||
        !isPositiveInteger(output_length)
    ) {
        return null
    }
    return {
        timeCost: time_cost,
        memoryCost: memory_cost,
        parallelism,
        outputLength: output_length,
    }
}

export const isDerivableArgon2idConfig = (config: Argon2idConfig): boolean =>
    config.memoryCost <= MAX_MEMORY_COST_MIB &&
    config.timeCost <= MAX_TIME_COST &&
    config.parallelism <= MAX_PARALLELISM &&
    config.outputLength === REQUIRED_OUTPUT_LENGTH

/** `length` is in bytes. */
export const isDerivableSaltLength = (length: number): boolean =>
    length >= MIN_SALT_LENGTH && length <= MAX_SALT_LENGTH
