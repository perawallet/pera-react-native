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

import { PWIcon, PWInput, type PWInputProps, PWView } from '@components/core'

import { QRScannerView } from '@components/QRScannerView'
import { useState } from 'react'
import { useLanguage } from '@hooks/useLanguage'
import { parseDeeplink } from '@hooks/deeplink/parser'
import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import type { Nullable } from '@perawallet/wallet-core-shared'

export type AddressEntryFieldProps = {
    allowQRCode?: boolean
    onScanned?: (address: string) => void
    testID?: string
} & PWInputProps

export const extractAddressFromScannedUrl = (url: string): Nullable<string> => {
    if (isValidAlgorandAddress(url)) return url

    const parsed = parseDeeplink(url)
    if (!parsed) return null

    if ('receiverAddress' in parsed && parsed.receiverAddress) {
        return parsed.receiverAddress
    }
    if ('address' in parsed && parsed.address) {
        return parsed.address
    }

    return null
}

export const AddressEntryField = ({
    allowQRCode,
    onScanned,
    testID,
    ...rest
}: AddressEntryFieldProps) => {
    const [scannerVisible, setScannerVisible] = useState(false)
    const { t } = useLanguage()

    const addressScanned = (url: string) => {
        const address = extractAddressFromScannedUrl(url)

        setScannerVisible(false)

        if (address) {
            rest.onChangeText?.(address)
            onScanned?.(address)
        }
    }

    const showScanner = () => {
        setScannerVisible(true)
    }

    const hideScanner = () => {
        setScannerVisible(false)
    }

    return (
        <PWView>
            <PWInput
                testID={testID}
                autoCapitalize='none'
                autoCorrect={false}
                {...rest}
                rightIcon={
                    allowQRCode ? (
                        <PWIcon
                            name='camera'
                            onPress={showScanner}
                        />
                    ) : undefined
                }
            />
            <QRScannerView
                isVisible={scannerVisible}
                onSuccess={addressScanned}
                onClose={hideScanner}
                animationType='slide'
                title={t('address_entry.scan_qr')}
                skipDeepLinkHandler
            />
        </PWView>
    )
}
