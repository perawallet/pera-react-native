import { config } from '@perawallet/core';
import PeraWebView from '../../components/webview/PeraWebView';
import { useStyles } from './styles';
import PeraView from '../../components/view/PeraView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DiscoverScreen = () => {
  const insets = useSafeAreaInsets()
  const styles = useStyles(insets);
  const url = config.discoverBaseUrl

  return (
    <PeraView style={styles.container}>
      <PeraWebView url={url} enablePeraConnect={true} containerStyle={styles.webview}/>
    </PeraView>
  );
};

export default DiscoverScreen;
