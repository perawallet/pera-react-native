import { TouchableOpacity } from 'react-native';
import PeraView from '../view/PeraView';
import { useStyles } from './styles';

import CameraIcon from '../../../../assets/icons/camera.svg';
import CloseIcon from '../../../../assets/icons/cross.svg';
import QRScannerView from '../qr-scanner/QRScannerView';
import { useState } from 'react';
import { Input, InputProps, useTheme } from '@rneui/themed';

export type AddressEntryFieldProps = {
  allowQRCode?: boolean;
} & InputProps;

const AddressEntryField = ({
  allowQRCode,
  ...rest
}: AddressEntryFieldProps) => {
  const styles = useStyles();
  const { theme } = useTheme();
  const [scannerVisible, setScannerVisible] = useState(false);

  const addressScanned = (_: string) => {
    //TODO parse URL and extract address
    setScannerVisible(false);
  };

  const showScanner = () => {
    setScannerVisible(true);
  };

  const hideScanner = () => {
    setScannerVisible(false);
  };

  return (
    <PeraView>
      <Input
        {...rest}
        rightIcon={
          allowQRCode && (
            <CameraIcon
              style={styles.icon}
              onPress={showScanner}
              color={theme.colors.textMain}
            />
          )
        }
      />
      {scannerVisible && (
        <QRScannerView
          onSuccess={addressScanned}
          animationType="slide"
          title="Scan QR Code"
          visible={scannerVisible}
        >
          <TouchableOpacity
            onPress={hideScanner}
            style={styles.closeIconButton}
          >
            <CloseIcon
              style={styles.closeIcon}
              color={theme.colors.textWhite}
            />
          </TouchableOpacity>
        </QRScannerView>
      )}
    </PeraView>
  );
};

export default AddressEntryField;
