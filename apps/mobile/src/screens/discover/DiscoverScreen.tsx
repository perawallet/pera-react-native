import { config } from '@perawallet/core';
import PeraWebView from '../../components/webview/PeraWebView';
import { useStyles } from './styles';
import PeraView from '../../components/view/PeraView';

const DiscoverScreen = () => {
  const styles = useStyles();
  const url = config.discoverBaseUrl

  return (
    <PeraView style={styles.container}>
      <PeraWebView url={url} enablePeraConnect={true} style={styles.webview} containerStyle={styles.webview}/>
    </PeraView>
  );
};

export default DiscoverScreen;
