import { config } from '@perawallet/core';
import PeraWebView from '../../components/webview/PeraWebView';
import { useStyles } from './styles';
import PeraView from '../../components/view/PeraView';

const StakingScreen = () => {
  const styles = useStyles();
  const url = config.stakingBaseUrl

  return (
    <PeraView style={styles.container}>
      <PeraWebView url={url} style={styles.webview} containerStyle={styles.webview}/>
    </PeraView>
  );
};

export default StakingScreen;
