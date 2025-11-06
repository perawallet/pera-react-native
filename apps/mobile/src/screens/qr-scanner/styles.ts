import { makeStyles } from '@rneui/themed';
import { EdgeInsets } from 'react-native-safe-area-context';

export const useStyles = makeStyles((theme, insets: EdgeInsets) => {
  return {
    container: {
      flex: 1,
      paddingTop: insets.top,
      marginBottom: insets.bottom,
      marginHorizontal: 0,
      paddingHorizontal: 0,
    },
    backButton: {
      zIndex: 2,
      marginHorizontal: theme.spacing.lg
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
      top: -60,
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
