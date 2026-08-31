import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from '../data/types';

/**
 * After a fresh sign-in:
 * - investors → open pitch deck immediately
 * - everyone else → soft optional feedback nudge
 */
export function FeedbackNudge() {
  const { justSignedIn, clearJustSignedIn, isInvestor } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    if (!justSignedIn) return;
    clearJustSignedIn();
    const timer = setTimeout(() => {
      if (isInvestor) {
        navigation.navigate('PitchDeck');
      } else {
        navigation.navigate('Feedback', { nudged: true });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [justSignedIn, clearJustSignedIn, isInvestor, navigation]);

  return null;
}
