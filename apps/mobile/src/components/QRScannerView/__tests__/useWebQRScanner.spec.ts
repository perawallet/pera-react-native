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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useWebQRScanner } from '../useWebQRScanner'

const DECODED_VALUE = 'ALGO-ADDRESS'

// Fake requestAnimationFrame: fires the callback on the next macrotask with a
// timestamp advanced well past the hook's internal detect-throttle window, so
// the loop proceeds every tick without real wall-clock waiting.
let fakeClock = 0
const rafCallbacks = new Map<number, FrameRequestCallback>()
let nextRafId = 1

const installFakeRaf = () => {
    fakeClock = 0
    rafCallbacks.clear()
    nextRafId = 1
    vi.stubGlobal(
        'requestAnimationFrame',
        (callback: FrameRequestCallback): number => {
            const id = nextRafId++
            rafCallbacks.set(id, callback)
            setTimeout(() => {
                if (!rafCallbacks.has(id)) return
                rafCallbacks.delete(id)
                fakeClock += 250
                callback(fakeClock)
            }, 0)
            return id
        },
    )
    vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
        rafCallbacks.delete(id)
    })
}

const flushAsync = async (times = 1) => {
    for (let i = 0; i < times; i++) {
        // eslint-disable-next-line no-await-in-loop -- sequential microtask/macrotask flush
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0))
        })
    }
}

const createFakeStream = () => {
    const stop = vi.fn()
    return {
        stream: { getTracks: () => [{ stop }] } as unknown as MediaStream,
        stop,
    }
}

describe('useWebQRScanner', () => {
    beforeEach(() => {
        installFakeRaf()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        Reflect.deleteProperty(navigator, 'mediaDevices')
    })

    it('detects a QR code from the camera, forwards it once, and stops the tracks', async () => {
        const { stream, stop } = createFakeStream()
        const getUserMedia = vi.fn().mockResolvedValue(stream)
        Object.defineProperty(navigator, 'mediaDevices', {
            value: { getUserMedia },
            configurable: true,
        })

        let detectCalls = 0
        const detect = vi.fn((source: unknown) => {
            detectCalls += 1
            expect(source).toBe(fakeVideoElement)
            if (detectCalls < 3) return Promise.resolve([])
            return Promise.resolve([{ rawValue: DECODED_VALUE }])
        })
        class FakeBarcodeDetector {
            static getSupportedFormats = vi.fn().mockResolvedValue(['qr_code'])
            detect = detect
        }
        vi.stubGlobal('BarcodeDetector', FakeBarcodeDetector)

        const onResult = vi.fn()
        const { result } = renderHook(() => useWebQRScanner(onResult))

        const fakeVideoElement = {} as HTMLVideoElement
        act(() => {
            result.current.videoRef.current = fakeVideoElement
        })

        await flushAsync(1) // getUserMedia resolves, loop starts
        await flushAsync(4) // several detect ticks until the match

        expect(onResult).toHaveBeenCalledTimes(1)
        expect(onResult).toHaveBeenCalledWith(DECODED_VALUE)
        expect(detectCalls).toBeGreaterThanOrEqual(3)
        expect(stop).toHaveBeenCalled()
    })

    it('flags a camera error when getUserMedia rejects, without throwing', async () => {
        const getUserMedia = vi.fn().mockRejectedValue(new Error('denied'))
        Object.defineProperty(navigator, 'mediaDevices', {
            value: { getUserMedia },
            configurable: true,
        })
        class FakeBarcodeDetector {
            static getSupportedFormats = vi.fn().mockResolvedValue(['qr_code'])
            detect = vi.fn()
        }
        vi.stubGlobal('BarcodeDetector', FakeBarcodeDetector)

        const onResult = vi.fn()
        const { result } = renderHook(() => useWebQRScanner(onResult))

        await flushAsync(1)

        expect(result.current.hasCameraError).toBe(true)
        expect(onResult).not.toHaveBeenCalled()
    })

    it('flags a camera error when BarcodeDetector is unsupported, leaving paste-only mode', async () => {
        const getUserMedia = vi
            .fn()
            .mockResolvedValue(createFakeStream().stream)
        Object.defineProperty(navigator, 'mediaDevices', {
            value: { getUserMedia },
            configurable: true,
        })
        // No global BarcodeDetector defined.

        const onResult = vi.fn()
        const { result } = renderHook(() => useWebQRScanner(onResult))

        await flushAsync(1)

        expect(result.current.hasCameraError).toBe(true)
        expect(onResult).not.toHaveBeenCalled()
        // Unsupported entirely: never even prompts for camera access.
        expect(getUserMedia).not.toHaveBeenCalled()
    })

    it('flags a camera error when the BarcodeDetector does not support qr_code, without entering a silent detect loop', async () => {
        const getUserMedia = vi
            .fn()
            .mockResolvedValue(createFakeStream().stream)
        Object.defineProperty(navigator, 'mediaDevices', {
            value: { getUserMedia },
            configurable: true,
        })
        class FakeBarcodeDetector {
            static getSupportedFormats = vi.fn().mockResolvedValue(['code_128'])
            detect = vi.fn()
        }
        vi.stubGlobal('BarcodeDetector', FakeBarcodeDetector)

        const onResult = vi.fn()
        const { result } = renderHook(() => useWebQRScanner(onResult))

        await flushAsync(1)

        expect(result.current.hasCameraError).toBe(true)
        expect(onResult).not.toHaveBeenCalled()
        expect(getUserMedia).not.toHaveBeenCalled()
    })

    it('falls back to paste when getSupportedFormats itself throws', async () => {
        const getUserMedia = vi
            .fn()
            .mockResolvedValue(createFakeStream().stream)
        Object.defineProperty(navigator, 'mediaDevices', {
            value: { getUserMedia },
            configurable: true,
        })
        class FakeBarcodeDetector {
            static getSupportedFormats = vi
                .fn()
                .mockRejectedValue(new Error('not implemented'))
            detect = vi.fn()
        }
        vi.stubGlobal('BarcodeDetector', FakeBarcodeDetector)

        const onResult = vi.fn()
        const { result } = renderHook(() => useWebQRScanner(onResult))

        await flushAsync(1)

        expect(result.current.hasCameraError).toBe(true)
        expect(onResult).not.toHaveBeenCalled()
        expect(getUserMedia).not.toHaveBeenCalled()
    })

    it('stops the tracks and cancels the detection loop on unmount', async () => {
        const { stream, stop } = createFakeStream()
        const getUserMedia = vi.fn().mockResolvedValue(stream)
        Object.defineProperty(navigator, 'mediaDevices', {
            value: { getUserMedia },
            configurable: true,
        })
        class FakeBarcodeDetector {
            static getSupportedFormats = vi.fn().mockResolvedValue(['qr_code'])
            detect = vi.fn().mockResolvedValue([])
        }
        vi.stubGlobal('BarcodeDetector', FakeBarcodeDetector)

        const onResult = vi.fn()
        const { unmount } = renderHook(() => useWebQRScanner(onResult))

        await flushAsync(1)
        unmount()

        expect(stop).toHaveBeenCalled()
        // No further detect ticks should be scheduled after unmount.
        const scheduledBeforeFlush = rafCallbacks.size
        await flushAsync(2)
        expect(rafCallbacks.size).toBeLessThanOrEqual(scheduledBeforeFlush)
        expect(onResult).not.toHaveBeenCalled()
    })

    it('submitPasted trims and forwards a non-empty pasted value', () => {
        // No camera globals stubbed for this case; the paste path must work
        // regardless of camera availability.
        const onResult = vi.fn()
        const { result } = renderHook(() => useWebQRScanner(onResult))

        act(() => {
            result.current.setPastedValue('   pasted-value   ')
        })
        act(() => {
            result.current.submitPasted()
        })

        expect(onResult).toHaveBeenCalledWith('pasted-value')
    })

    it('does not forward an empty or whitespace-only pasted value', () => {
        const onResult = vi.fn()
        const { result } = renderHook(() => useWebQRScanner(onResult))

        act(() => {
            result.current.setPastedValue('   ')
        })
        act(() => {
            result.current.submitPasted()
        })

        expect(onResult).not.toHaveBeenCalled()
    })

    it('never calls getUserMedia when autoStart is false (popup surface)', async () => {
        const getUserMedia = vi
            .fn()
            .mockResolvedValue(createFakeStream().stream)
        Object.defineProperty(navigator, 'mediaDevices', {
            value: { getUserMedia },
            configurable: true,
        })
        class FakeBarcodeDetector {
            static getSupportedFormats = vi.fn().mockResolvedValue(['qr_code'])
            detect = vi.fn()
        }
        vi.stubGlobal('BarcodeDetector', FakeBarcodeDetector)

        const onResult = vi.fn()
        const { result } = renderHook(() =>
            useWebQRScanner(onResult, { autoStart: false }),
        )

        await flushAsync(1)

        expect(getUserMedia).not.toHaveBeenCalled()
        expect(result.current.hasCameraError).toBe(false)
        expect(result.current.isCameraActive).toBe(false)
    })
})
