import { useStyles } from './styles';
import { ParamListBase, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TouchableOpacity } from 'react-native';
import PeraView from '../../components/common/view/PeraView';
import ChevronLeft from '../../../assets/icons/chevron-left.svg'
import { useTheme } from '@rneui/themed';
import { useDeepLink } from '../../hooks/deeplink';
import QRScannerView from '../../components/common/qr-scanner/QRScannerView';


const QRScannerScreen = () => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useStyles(insets);
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const {handleDeepLink, isValidDeepLink} = useDeepLink()
  const deepLinkFound = (url: string, restartScanning: () => void) => {
    if (url && isValidDeepLink(url, 'qr')) {
      handleDeepLink(url, true, 'qr',
        () => {restartScanning()})
    }
  }

  const goBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack()
    }
  }

  return (
    <PeraView style={styles.container}>
      <QRScannerView onSuccess={deepLinkFound}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <ChevronLeft style={styles.icon} color={theme.colors.textWhite} />
        </TouchableOpacity>
      </QRScannerView>
    </PeraView>
  );
};

export default QRScannerScreen;
