import React, { useEffect, useState } from 'react';
import LottieView from 'lottie-react-native';
import confettiAnimation from '@assets/animations/confetti.json';
import { useStyles } from './styles';

const ConfettiAnimation = ({ play }: { play: boolean }) => {
    const styles = useStyles()
    const [visible, setVisible] = useState<boolean>(play)

    useEffect(() => {
        setVisible(play)
    }, [play])

    const hideAnimation = () => {
        setVisible(false)
    }

    if (!visible) {
        return null
    }

    return (
        <LottieView
            autoPlay={true}
            loop={false}
            onAnimationFinish={hideAnimation}
            source={confettiAnimation}
            style={styles.container}
        />
    )
}

export default ConfettiAnimation;
