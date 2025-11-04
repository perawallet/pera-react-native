import { makeStyles } from '@rneui/themed';
import { PropsWithChildren } from 'react';

export const useStyles = makeStyles((theme, _: PropsWithChildren) => {
  return {
    container: {
        flexDirection: 'row',
        gap: theme.spacing.lg,
        alignItems: 'flex-start'
    },
    messageBox: {

    },
    timeText: {
      color: theme.colors.textGray,
      fontSize: 11
    },
    iconContainerNoBorder: {
      width: theme.spacing.xl * 1.65,
      height: theme.spacing.xl * 1.65,
      borderRadius: theme.spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconContainer: {
      width: theme.spacing.xl * 1.65,
      height: theme.spacing.xl * 1.65,
      borderRadius: theme.spacing.xl,
      borderWidth: 1,
      borderColor: theme.colors.layerGrayLighter,
      alignItems: 'center',
      justifyContent: 'center',
    },
    image: {
      aspectRatio: 1,
      width: '100%',
    },
    imageCircle: {
      aspectRatio: 1,
      width: '100%',
      borderRadius: '50%'
    }
  };
});
