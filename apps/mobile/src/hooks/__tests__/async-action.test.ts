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

import { renderHook, act } from '@testing-library/react-native'
import { useAsyncAction } from '../async-action'

describe('useAsyncAction', () => {
    it('should handle successful execution', async () => {
        const mockAction = jest.fn().mockResolvedValue('success')
        const { result } = renderHook(() => useAsyncAction(mockAction))

        expect(result.current.isProcessing).toBe(false)
        expect(result.current.error).toBe(null)

        let executionResult: string | undefined
        await act(async () => {
            executionResult = (await result.current.execute('arg1', 123)) as
                | string
                | undefined
        })

        expect(mockAction).toHaveBeenCalledWith('arg1', 123)
        expect(executionResult).toBe('success')
        expect(result.current.isProcessing).toBe(false)
        expect(result.current.error).toBe(null)
    })

    it('should handle execution error', async () => {
        const mockError = new Error('failed')
        const mockAction = jest.fn().mockRejectedValue(mockError)
        const { result } = renderHook(() => useAsyncAction(mockAction))

        await act(async () => {
            try {
                await result.current.execute()
            } catch {
                // Expected
            }
        })

        expect(result.current.isProcessing).toBe(false)
        expect(result.current.error).toBe(mockError)
    })

    it('should handle non-Error catch values', async () => {
        const mockAction = jest.fn().mockRejectedValue('string error')
        const { result } = renderHook(() => useAsyncAction(mockAction))

        await act(async () => {
            try {
                await result.current.execute()
            } catch {
                // Expected
            }
        })

        expect(result.current.error).toBeInstanceOf(Error)
        expect(result.current.error?.message).toBe('string error')
    })

    it('should reset state', async () => {
        const mockAction = jest.fn().mockRejectedValue(new Error('failed'))
        const { result } = renderHook(() => useAsyncAction(mockAction))

        await act(async () => {
            try {
                await result.current.execute()
            } catch {
                // Expected
            }
        })

        expect(result.current.error).not.toBe(null)

        act(() => {
            result.current.reset()
        })

        expect(result.current.isProcessing).toBe(false)
        expect(result.current.error).toBe(null)
    })
})
