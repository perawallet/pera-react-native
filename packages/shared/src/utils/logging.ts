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

import { config } from '@perawallet/wallet-core-config'

/**
 * Log levels for controlling log output and error reporting
 */
export enum LogLevel {
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error',
    CRITICAL = 'critical',
}

/**
 * Interface for structured log context
 */
export interface LogContext {
    [key: string]: unknown
}

/**
 * Debug-level logging - only shows when debug is enabled
 */
export const debugLog = (message: string, ...args: unknown[]) => {
    if (config.debugEnabled) {
        console.log(`[DEBUG] ${message}`, ...args)
    }
}

/**
 * Info-level logging - general information
 */
export const infoLog = (message: string, ...args: unknown[]) => {
    console.log(`[INFO] ${message}`, ...args)
}

/**
 * Warning-level logging - potential issues
 */
export const warnLog = (message: string, ...args: unknown[]) => {
    console.warn(`[WARN] ${message}`, ...args)
}

/**
 * Error-level logging - errors that should be reported
 * Note: Crashlytics reporting is handled at the error boundary level
 */
export const errorLog = (error: Error | string, context?: LogContext) => {
    const errorMessage = error instanceof Error ? error.message : error
    console.error(`[ERROR] ${errorMessage}`, context)
}

/**
 * Critical-level logging - critical errors that should always be reported
 * Note: Crashlytics reporting is handled at the error boundary level
 */
export const criticalLog = (error: Error | string, context?: LogContext) => {
    const errorMessage = error instanceof Error ? error.message : error
    console.error(`[CRITICAL] ${errorMessage}`, context)
}

/**
 * Generic log function with level control
 */
export const log = (
    level: LogLevel,
    message: string,
    context?: LogContext,
) => {
    switch (level) {
        case LogLevel.DEBUG:
            debugLog(message, context)
            break
        case LogLevel.INFO:
            infoLog(message, context)
            break
        case LogLevel.WARN:
            warnLog(message, context)
            break
        case LogLevel.ERROR:
            errorLog(message, context)
            break
        case LogLevel.CRITICAL:
            criticalLog(message, context)
            break
    }
}
