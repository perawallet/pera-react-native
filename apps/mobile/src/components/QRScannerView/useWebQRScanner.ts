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

import { useCallback, useEffect, useRef, useState } from 'react'
import { logger } from '@perawallet/wallet-core-shared'

// `BarcodeDetector` is a Chrome-only API (behind no flag since Chrome 83) and
// is not part of TypeScript's lib.dom — Firefox/Safari lack it entirely, so
// this is declared locally rather than assumed globally available.
type BarcodeDetectorLike = {
    detect: (source: unknown) => Promise<Array<{ rawValue: string }>>
}

type BarcodeDetectorCtor = (new (options: {
    formats: string[]
}) => BarcodeDetectorLike) & {
    getSupportedFormats?: () => Promise<string[]>
}

// Throttle window between successive `detect()` calls. Decoding a frame is
// relatively expensive; there is no benefit to running it on every animation
// frame (~16ms), so we gate on the rAF-supplied timestamp instead of running
// a separate `setInterval` poll.
const DETECT_INTERVAL_MS = 200

/**
 * Feature-detects a *usable* `BarcodeDetector`: present AND able to decode
 * `qr_code` per `getSupportedFormats()` (some implementations expose the
 * constructor but only support other symbologies). This is checked once up
 * front — not per-tick — so an unsupported browser falls straight to
 * paste-only instead of silently spinning a detect loop that can never
 * match. `getSupportedFormats` throwing, or being absent on the
 * constructor, is treated the same as "unsupported": paste-only.
 */
const getBarcodeDetectorCtor =
    async (): Promise<BarcodeDetectorCtor | null> => {
        if (typeof window === 'undefined') return null
        const ctor = (window as unknown as { BarcodeDetector?: unknown })
            .BarcodeDetector
        if (typeof ctor !== 'function') return null
        const BarcodeDetectorImpl = ctor as BarcodeDetectorCtor
        try {
            const formats = await BarcodeDetectorImpl.getSupportedFormats?.()
            if (!formats?.includes('qr_code')) return null
        } catch (error) {
            logger.debug('useWebQRScanner: getSupportedFormats() failed', {
                error,
            })
            return null
        }
        return BarcodeDetectorImpl
    }

export type UseWebQRScannerOptions = {
    /**
     * When `false`, the camera/`getUserMedia` effect never runs — the hook
     * stays in a dormant, paste-only state. Used in the popup surface: the
     * `getUserMedia` permission prompt is a focus-stealing OS dialog, and
     * Chrome tears down the 360x600 toolbar popup the instant it loses
     * focus (see `extensions/platform-chrome/src/navigation.ts`). Defaults
     * to `true`.
     */
    autoStart?: boolean
}

export type UseWebQRScannerResult = {
    isCameraActive: boolean
    hasCameraError: boolean
    videoRef: React.RefObject<HTMLVideoElement | null>
    pastedValue: string
    setPastedValue: (value: string) => void
    submitPasted: () => void
}

/**
 * Web-only QR capture: `getUserMedia` + the browser's built-in
 * `BarcodeDetector` for camera decoding, with a manual paste field as a
 * fallback for browsers that lack `BarcodeDetector` (Firefox) or when camera
 * permission is denied. Callers get a single `onResult` callback fed by
 * whichever path succeeds first — the hook does not know or care about QR
 * payload semantics (deep link validity, WalletConnect URIs, etc.); that's
 * the consuming component's job.
 */
export const useWebQRScanner = (
    onResult: (value: string) => void,
    options: UseWebQRScannerOptions = {},
): UseWebQRScannerResult => {
    const { autoStart = true } = options
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const rafRef = useRef<number | null>(null)
    const lastDetectAtRef = useRef(0)
    const resolvedRef = useRef(false)

    // Kept in a ref so the detect loop always calls the latest `onResult`
    // without needing to restart the camera/effect when it changes identity.
    const onResultRef = useRef(onResult)
    onResultRef.current = onResult

    const [isCameraActive, setIsCameraActive] = useState(false)
    const [hasCameraError, setHasCameraError] = useState(false)
    const [pastedValue, setPastedValue] = useState('')

    const stopStream = useCallback(() => {
        if (rafRef.current != null) {
            cancelAnimationFrame(rafRef.current)
            rafRef.current = null
        }
        streamRef.current?.getTracks().forEach(track => track.stop())
        streamRef.current = null
    }, [])

    useEffect(() => {
        resolvedRef.current = false

        // Popup surface: never touch getUserMedia (see UseWebQRScannerOptions
        // doc). The hook just stays dormant; the paste field is unaffected.
        if (!autoStart) return

        let cancelled = false

        const start = async () => {
            const BarcodeDetectorImpl = await getBarcodeDetectorCtor()
            if (cancelled) return

            if (
                typeof navigator === 'undefined' ||
                !navigator.mediaDevices?.getUserMedia ||
                !BarcodeDetectorImpl
            ) {
                setHasCameraError(true)
                return
            }

            const detector = new BarcodeDetectorImpl({ formats: ['qr_code'] })

            const tick = (time: number) => {
                if (cancelled || resolvedRef.current) return

                if (time - lastDetectAtRef.current < DETECT_INTERVAL_MS) {
                    rafRef.current = requestAnimationFrame(tick)
                    return
                }
                lastDetectAtRef.current = time

                const video = videoRef.current
                if (!video) {
                    rafRef.current = requestAnimationFrame(tick)
                    return
                }

                void detector
                    .detect(video)
                    .then(barcodes => {
                        if (cancelled || resolvedRef.current) return
                        const value = barcodes.at(0)?.rawValue
                        if (!value) {
                            rafRef.current = requestAnimationFrame(tick)
                            return
                        }
                        resolvedRef.current = true
                        stopStream()
                        setIsCameraActive(false)
                        onResultRef.current(value)
                    })
                    .catch((error: unknown) => {
                        logger.debug('useWebQRScanner: detect() failed', {
                            error,
                        })
                        if (cancelled || resolvedRef.current) return
                        rafRef.current = requestAnimationFrame(tick)
                    })
            }

            void navigator.mediaDevices
                .getUserMedia({ video: { facingMode: 'environment' } })
                .then(stream => {
                    if (cancelled) {
                        stream.getTracks().forEach(track => track.stop())
                        return
                    }
                    streamRef.current = stream
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream
                    }
                    setIsCameraActive(true)
                    rafRef.current = requestAnimationFrame(tick)
                })
                .catch((error: unknown) => {
                    logger.debug('useWebQRScanner: getUserMedia() failed', {
                        error,
                    })
                    if (cancelled) return
                    setHasCameraError(true)
                })
        }

        void start()

        return () => {
            cancelled = true
            stopStream()
        }
    }, [stopStream, autoStart])

    const submitPasted = useCallback(() => {
        const trimmed = pastedValue.trim()
        if (!trimmed) return
        onResultRef.current(trimmed)
    }, [pastedValue])

    return {
        isCameraActive,
        hasCameraError,
        videoRef,
        pastedValue,
        setPastedValue,
        submitPasted,
    }
}
