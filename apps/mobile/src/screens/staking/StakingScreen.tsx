import { config } from '@perawallet/config';
import PeraWebView from '../../components/common/webview/PeraWebView';
import { useStyles } from './styles';
import PeraView from '../../components/common/view/PeraView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const StakingScreen = () => {
  const insets = useSafeAreaInsets();
  const styles = useStyles(insets);
  const url = config.stakingBaseUrl;

  return (
    <PeraView style={styles.container}>
      <PeraWebView
        url={url}
        enablePeraConnect={true}
        style={styles.webview}
        containerStyle={styles.webview}
      />
    </PeraView>
  );
};

export default StakingScreen;
