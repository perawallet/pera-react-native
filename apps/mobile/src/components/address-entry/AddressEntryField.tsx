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

import { TouchableOpacity } from 'react-native'
import PWView from '@components/view/PWView'
import { useStyles } from '@components/address-entry/styles'

import QRScannerView from '@components/qr-scanner/QRScannerView'
import { useState } from 'react'
import { Input, InputProps } from '@rneui/themed'
import PWIcon from '@components/icons/PWIcon'
import { useLanguage } from '@hooks/language'

export type AddressEntryFieldProps = {
    allowQRCode?: boolean
} & InputProps

const AddressEntryField = ({
    allowQRCode,
    ref,
    ...rest
}: AddressEntryFieldProps) => {
    const styles = useStyles()
    const [scannerVisible, setScannerVisible] = useState(false)
    const { t } = useLanguage()

    const addressScanned = () => {
        //TODO parse URL and extract address
        setScannerVisible(false)
    }

    const showScanner = () => {
        setScannerVisible(true)
    }

    const hideScanner = () => {
        setScannerVisible(false)
    }

    return (
        <PWView>
            <Input
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
            {scannerVisible && (
                <QRScannerView
                    onSuccess={addressScanned}
                    animationType='slide'
                    title={t('address_entry.scan_qr')}
                    visible={scannerVisible}
                >
                    <TouchableOpacity
                        onPress={hideScanner}
                        style={styles.closeIconButton}
                    >
                        <PWIcon
                            name='cross'
                            variant='white'
                        />
                    </TouchableOpacity>
                </QRScannerView>
            )}
        </PWView>
    )
}

export default AddressEntryField
