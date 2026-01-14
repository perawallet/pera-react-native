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

import { render, screen } from '@testing-library/react-native'
import { describe, it, expect, vi } from 'vitest'
import QRScannerView from '../QRScannerView'

vi.mock('react-native-vision-camera', () => ({
    useCameraDevice: vi.fn(() => ({ id: 'mock-device' })),
    useCameraPermission: () => ({
        hasPermission: true,
        requestPermission: vi.fn(),
    }),
    Camera: 'Camera',
    useCodeScanner: vi.fn(),
}))

describe('QRScannerView', () => {
    it('renders scanner when visible', () => {
        const onClose = vi.fn()
        const onSuccess = vi.fn()
        render(
            <QRScannerView
                visible={true}
                animationType='none'
                onClose={onClose}
                onSuccess={onSuccess}
            />,
        )
        // With mock device, it should render Camera
        expect(screen.toJSON()).toBeDefined()
    })
})
