import { useStyles } from './styles';
import { ParamListBase, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TouchableOpacity } from 'react-native';
import PeraView from '../../components/common/view/PeraView';
import ChevronLeft from '../../../assets/icons/chevron-left.svg'
import CameraOverlay from '../../../assets/images/camera-overlay.svg'
import { useCameraPermission, useCameraDevice, Camera, useCodeScanner } from 'react-native-vision-camera'
import { Text, useTheme } from '@rneui/themed';
import { useDeepLink } from '../../hooks/deeplink';
import { useState } from 'react';


const QRScannerScreen = () => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useStyles(insets);
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const device = useCameraDevice('back')
  const { hasPermission, requestPermission } = useCameraPermission()
  const [scanningEnabled, setScanningEnabled] = useState(true)
  const {handleDeepLink, isValidDeepLink} = useDeepLink()
  const codeScanner = useCodeScanner({
      codeTypes: ['qr', 'ean-13'],
      onCodeScanned: (codes) => {
        const url = codes.at(0)?.value
        setScanningEnabled(false)
        if (url && isValidDeepLink(url, 'qr')) {
          handleDeepLink(url, true, 'qr',
            () => {setScanningEnabled(true)})
        }
      }
  })

  const goBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack()
    }
  }

  if (!hasPermission) {
      requestPermission()
  }
  if (device == null) {
      return <PeraView><Text>No camera device found.</Text></PeraView>
  }

  return (
    <PeraView style={styles.container}>
      <TouchableOpacity onPress={goBack} style={styles.backButton}>
        <ChevronLeft style={styles.icon} color={theme.colors.textWhite} />
      </TouchableOpacity>
      <Camera
          style={styles.camera}
          codeScanner={codeScanner}
          device={device}
          isActive={scanningEnabled}
      />
      <CameraOverlay style={styles.overlay} />
      <Text h2 h2Style={styles.title}>Find a code to scan</Text>
    </PeraView>
  );
};

export default QRScannerScreen;
