import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {LoginScreen} from '@/screens/auth/login-screen';
import {RegisterScreen} from '@/screens/auth/register-screen';
import {WelcomeScreen} from '@/screens/public/welcome-screen';
import type {PublicStackParamList} from '@/navigation/types';

const Stack = createNativeStackNavigator<PublicStackParamList>();

export function PublicNavigator() {
  return (
    <Stack.Navigator initialRouteName="Login">
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}
