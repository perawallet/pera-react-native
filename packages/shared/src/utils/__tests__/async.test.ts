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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { deferToNextCycle } from '../async'

describe('deferToNextCycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defers execution to the next event loop cycle', async () => {
    const callback = vi.fn()
    deferToNextCycle(callback)

    expect(callback).not.toHaveBeenCalled()

    await vi.runAllTimersAsync()

    expect(callback).toHaveBeenCalled()
  })

  it('resolves the promise with the callback return value', async () => {
    const callback = vi.fn().mockReturnValue('result')
    const promise = deferToNextCycle(callback)

    await vi.runAllTimersAsync()

    const result = await promise
    expect(result).toBe('result')
    expect(callback).toHaveBeenCalled()
  })

  it('resolves the promise wrapping an async callback', async () => {
    const callback = vi.fn().mockResolvedValue('async-result')
    const promise = deferToNextCycle(callback)

    await vi.runAllTimersAsync()

    const result = await promise
    expect(result).toBe('async-result')
    expect(callback).toHaveBeenCalled()
  })

  it('rejects the promise if the callback throws', async () => {
    const error = new Error('test-error')
    const callback = vi.fn().mockImplementation(() => {
      throw error
    })

    // Catch the rejection as soon as it happens to avoid unhandled rejection warnings
    const promiseResult = deferToNextCycle(callback).catch(err => err)

    await vi.runAllTimersAsync()

    const caughtError = await promiseResult
    expect(caughtError).toBe(error)
    expect(callback).toHaveBeenCalled()
  })

  it('rejects the promise if the async callback rejects', async () => {
    const error = new Error('test-async-error')
    const callback = vi.fn().mockRejectedValue(error)

    // Catch the rejection as soon as it happens to avoid unhandled rejection warnings
    const promiseResult = deferToNextCycle(callback).catch(err => err)

    await vi.runAllTimersAsync()

    const caughtError = await promiseResult
    expect(caughtError).toBe(error)
    expect(callback).toHaveBeenCalled()
  })

  it('supports a custom delay', async () => {
    const callback = vi.fn()
    const delay = 500
    deferToNextCycle(callback, delay)

    vi.advanceTimersByTime(250)
    expect(callback).not.toHaveBeenCalled()

    vi.advanceTimersByTime(250)
    await vi.runAllTimersAsync()

    expect(callback).toHaveBeenCalled()
  })

  it('works as a sleep function when no callback is provided', async () => {
    const delay = 500
    const promise = deferToNextCycle(delay)

    vi.advanceTimersByTime(250)
    let resolved = false
    promise.then(() => {
      resolved = true
    })

    await Promise.resolve() // handle microtasks
    expect(resolved).toBe(false)

    vi.advanceTimersByTime(250)
    await vi.runAllTimersAsync()
    await promise

    expect(true).toBe(true) // Promise should have resolved
  })
})
