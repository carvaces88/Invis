import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from '../data/types';

/** After a fresh sign-in, softly open the optional feedback screen once. */
export function FeedbackNudge() {
  const { justSignedIn, clearJustSignedIn } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    if (!justSignedIn) return;
    clearJustSignedIn();
    const timer = setTimeout(() => {
      navigation.navigate('Feedback', { nudged: true });
    }, 600);
    return () => clearTimeout(timer);
  }, [justSignedIn, clearJustSignedIn, navigation]);

  return null;
}
