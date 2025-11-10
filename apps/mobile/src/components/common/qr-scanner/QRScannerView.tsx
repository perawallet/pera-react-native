import { useStyles } from './styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PeraView from '../../../components/common/view/PeraView';
import CameraOverlay from '../../../../assets/images/camera-overlay.svg'
import { useCameraPermission, useCameraDevice, Camera, useCodeScanner } from 'react-native-vision-camera'
import { Text } from '@rneui/themed';
import { PropsWithChildren, useState } from 'react';


type QRScannerViewProps = {
    title?: string
    onSuccess: (url: string, restartScanning: () => void) => void
} & PropsWithChildren

const QRScannerView = (props: QRScannerViewProps) => {
  const styles = useStyles();
  const device = useCameraDevice('back')
  const { hasPermission, requestPermission } = useCameraPermission()
  const [scanningEnabled, setScanningEnabled] = useState(true)
  const codeScanner = useCodeScanner({
      codeTypes: ['qr', 'ean-13'],
      onCodeScanned: (codes) => {
        const url = codes.at(0)?.value
        setScanningEnabled(false)
        if (url) {
            props.onSuccess(url, () => setScanningEnabled(true))
        }
      }
  })

  if (!hasPermission) {
      requestPermission()
  }
  if (device == null) {
      return <PeraView><Text>No camera device found.</Text></PeraView>
  }

  return (
    <PeraView style={styles.container}>
      {props.children}
      <Camera
          style={styles.camera}
          codeScanner={codeScanner}
          device={device}
          isActive={scanningEnabled}
      />
      <CameraOverlay style={styles.overlay} />
      <Text h2 h2Style={styles.title}>{props.title ?? 'Find a code to scan'}</Text>
    </PeraView>
  );
};

export default QRScannerView;
