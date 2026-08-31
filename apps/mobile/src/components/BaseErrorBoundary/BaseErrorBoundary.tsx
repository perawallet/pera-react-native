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

import { Component, type ErrorInfo, type ReactNode } from 'react'
import {
    AppError,
    type ErrorCategory,
    logger,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { EmptyView } from '@components/EmptyView'

export interface BaseErrorBoundaryProps {
    children: ReactNode
    fallback?: (error: AppError | Error, reset: () => void) => ReactNode
    onError?: (error: AppError | Error, errorInfo: ErrorInfo) => void
    category?: ErrorCategory
    t: (key: string, options?: Record<string, unknown>) => string
}

interface BaseErrorBoundaryState {
    error: Nullable<AppError | Error>
    errorInfo: Nullable<ErrorInfo>
}

/**
 * Base error boundary component with typed error handling
 * Provides automatic Crashlytics reporting and customizable fallback UI
 */
export class BaseErrorBoundary extends Component<
    BaseErrorBoundaryProps,
    BaseErrorBoundaryState
> {
    constructor(props: BaseErrorBoundaryProps) {
        super(props)
        this.state = {
            error: null,
            errorInfo: null,
        }
    }

    static getDerivedStateFromError(
        error: Error,
    ): Partial<BaseErrorBoundaryState> {
        return { error }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({ errorInfo })

        // Convert to AppError if not already
        const appError = error instanceof AppError ? error : null

        // `shouldReport()` answers a different question from `metadata.expected`
        // — it is a severity test, so a HIGH-severity error flagged expected
        // (the Ledger connection classes) escalates to `critical` here instead
        // of being downgraded. Left as is: it fails in the safe direction.
        if (appError?.shouldReport()) {
            logger.critical(error, {
                category: this.props.category,
                componentStack: errorInfo.componentStack,
            })
        } else {
            logger.error(error, {
                category: this.props.category,
                componentStack: errorInfo.componentStack,
            })
        }

        // Call custom error handler
        this.props.onError?.(error, errorInfo)
    }

    reset = () => {
        this.setState({ error: null, errorInfo: null })
    }

    render() {
        const { error } = this.state
        const { children, fallback } = this.props

        if (error) {
            if (fallback) {
                return fallback(error, this.reset)
            }

            return (
                <EmptyView
                    title={this.props.t('errors.general.title')}
                    body={this.props.t('errors.general.body')}
                />
            )
        }

        return children
    }
}
