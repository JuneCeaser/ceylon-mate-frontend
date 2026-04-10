import { useEffect, useRef } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/theme';

export default function Index() {
  const router = useRouter();
  const segments = useSegments();
  const { user, userProfile, loading } = useAuth();
  const navigationAttempted = useRef(false);

  useEffect(() => {
    if (loading || navigationAttempted.current) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!user && !inAuthGroup) {
      navigationAttempted.current = true;
      router.replace('/auth/login');
    } else if (user && userProfile) {
      navigationAttempted.current = true;
      if (userProfile.userType === 'tourist') {
        router.replace('/(tourist)/dashboard');
      } else if (userProfile.userType === 'hotel') {
        router.replace('/(hotel)/dashboard');
      }
    }
  }, [user, userProfile, loading, segments]);

  return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
  );
}