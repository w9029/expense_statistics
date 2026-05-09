import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {LoginPlaceholderScreen} from '@/screens/auth/login-placeholder-screen';
import {RegisterPlaceholderScreen} from '@/screens/auth/register-placeholder-screen';
import {InvitationPlaceholderScreen} from '@/screens/invitation/invitation-placeholder-screen';
import {WelcomeScreen} from '@/screens/public/welcome-screen';
import type {PublicStackParamList} from '@/navigation/types';

const Stack = createNativeStackNavigator<PublicStackParamList>();

export function PublicNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen name="Login" component={LoginPlaceholderScreen} />
      <Stack.Screen name="Register" component={RegisterPlaceholderScreen} />
      <Stack.Screen name="Invitation" component={InvitationPlaceholderScreen} />
    </Stack.Navigator>
  );
}
