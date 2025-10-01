import { makeStyles } from '@rneui/themed';
import { PropsWithChildren } from 'react';

export const useStyles = makeStyles((theme, _: PropsWithChildren) => {
  return {
    titleContainer: {
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    cardContainer: {
      backgroundColor: theme.colors.layerGrayLighter,
      borderRadius: theme.spacing.lg,
    },
    cardHeaderContainer: {
      flexDirection: 'row',
    },
    cardTextContainer: {
      padding: theme.spacing.lg,
      gap: theme.spacing.xl,
      flexDirection: 'column',
      flexGrow: 1,
    },
    cardImageContainer: {
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
    },
    cardSecondaryText: {
      color: theme.colors.textGray,
      marginBottom: theme.spacing.xl,
    },
    cardButtonContainer: {
      padding: theme.spacing.lg,
    },
    icon: {
      color: theme.colors.textMain,
      backgroundColor: theme.colors.layerGrayLighter,
    },
    buttonIcon: {
      color: theme.colors.buttonPrimaryText,
      backgroundColor: theme.colors.primary,
    },
    backgroundImage: {
      marginTop: theme.spacing.lg,
      width: 116,
      height: 124,
    },
  };
});
