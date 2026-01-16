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
 * Ordered by severity: DEBUG < INFO < WARN < ERROR < CRITICAL
 */
export const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    CRITICAL: 4,
} as const

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel]

const LOG_LEVEL_NAMES = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR',
    [LogLevel.CRITICAL]: 'CRITICAL',
}

/**
 * Interface for structured log context
 */
export interface LogContext {
    [key: string]: unknown
}

/**
 * A logger utility that supports structured context and severity levels.
 * Filtered by the minimum log level defined in the application config.
 */
class Logger {
    private level: LogLevel = LogLevel.ERROR // Default safe level

    constructor() {
        // Initialize level based on config
        // In a real app we might load this from a remote config or local storage
        if (config.debugEnabled) {
            this.level = LogLevel.DEBUG
        }
    }

    /**
     * Set the minimum log level for output
     */
    public setLevel(level: LogLevel) {
        this.level = level
    }

    /**
     * Logs a message at the DEBUG level.
     * @param message - The log message
     * @param context - Structured context to include with the log
     */
    public debug(message: string, context?: LogContext) {
        this.log(LogLevel.DEBUG, message, context)
    }

    /**
     * Logs a message at the INFO level.
     * @param message - The log message
     * @param context - Structured context to include with the log
     */
    public info(message: string, context?: LogContext) {
        this.log(LogLevel.INFO, message, context)
    }

    /**
     * Logs a message at the WARN level.
     * @param message - The log message
     * @param context - Structured context to include with the log
     */
    public warn(message: string, context?: LogContext) {
        this.log(LogLevel.WARN, message, context)
    }

    /**
     * Logs an error at the ERROR level.
     * @param error - The error object or message
     * @param context - Structured context to include with the log
     */
    public error(error: Error | string, context?: LogContext) {
        this.log(LogLevel.ERROR, error, context)
    }

    /**
     * Logs a critical error at the CRITICAL level.
     * @param error - The error object or message
     * @param context - Structured context to include with the log
     */
    public critical(error: Error | string, context?: LogContext) {
        this.log(LogLevel.CRITICAL, error, context)
    }

    private log(
        level: LogLevel,
        messageOrError: string | Error,
        context?: LogContext,
    ) {
        // Filter out logs below current level
        if (level < this.level) {
            return
        }

        const prefix = `[${LOG_LEVEL_NAMES[level]}]`
        const message =
            messageOrError instanceof Error
                ? messageOrError.message
                : messageOrError

        // Pass context as second argument if present, otherwise just the message
        const args = context ? [context] : []

        switch (level) {
            case LogLevel.DEBUG:
            case LogLevel.INFO:
                console.log(`${prefix} ${message}`, ...args)
                break
            case LogLevel.WARN:
                console.warn(`${prefix} ${message}`, ...args)
                break
            case LogLevel.ERROR:
            case LogLevel.CRITICAL:
                console.error(`${prefix} ${message}`, ...args)
                break
        }
    }
}

export const logger = new Logger()
