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

import React from 'react'

type FallbackProps = { error: Error; resetError: () => void }

type Props = React.PropsWithChildren<{
    FallbackComponent: React.ComponentType<FallbackProps>
    onError?: (error: Error, stackTrace: string) => void
}>

type State = { error: Error | null }

// Mirrors react-native-error-boundary@3.1.0, which ships untranspiled JSX
// that vitest's parser can't read. Same catch semantics and `resetError`
// contract, so boundary-dependent specs exercise the real behavior.
class ErrorBoundary extends React.Component<Props, State> {
    state: State = { error: null }

    static getDerivedStateFromError(error: Error): State {
        return { error }
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        this.props.onError?.(error, info.componentStack ?? '')
    }

    resetError = () => {
        this.setState({ error: null })
    }

    render() {
        const { FallbackComponent } = this.props
        return this.state.error ? (
            <FallbackComponent
                error={this.state.error}
                resetError={this.resetError}
            />
        ) : (
            this.props.children
        )
    }
}

export default ErrorBoundary
