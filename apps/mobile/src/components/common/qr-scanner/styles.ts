import { makeStyles } from '@rneui/themed';
import { EdgeInsets } from 'react-native-safe-area-context';

export const useStyles = makeStyles((theme, insets: EdgeInsets) => {
  return {
    container: {
      flex: 1,
      margin: 0,
      padding: 0,
    },
    camera: {
      flex: 1,
      position: 'absolute',
      top: 0,
      bottom: 0, 
      left: 0,
      right: 0,
    },
    overlay: {
      alignItems: 'center',
      zIndex: 1,
      position: 'absolute',
      top: -100,
      bottom: 0, 
      left: 0,
      right: 0,
    },
    title: {
      color: theme.colors.textWhite,
      textAlign: 'center',
      marginTop: theme.spacing.xl * 1.5,
      marginBottom: theme.spacing.xl,
      zIndex: 2
    },
    icon: {
      color: theme.colors.textWhite,
      zIndex: 2
    }
  };
});
