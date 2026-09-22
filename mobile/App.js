import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import DashboardScreen from './screens/DashboardScreen';
import OrdersScreen from './screens/OrdersScreen';
import OrderDetailsScreen from './screens/OrderDetailsScreen';
import ProductionScreen from './screens/ProductionScreen';
import SalesScreen from './screens/SalesScreen';
import ProductsScreen from './screens/ProductsScreen';
import ReportsScreen from './screens/ReportsScreen';
import SettingsScreen from './screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const OrdersStack = createNativeStackNavigator();

function OrdersStackScreen() {
  return (
    <OrdersStack.Navigator>
      <OrdersStack.Screen name="OrdersList" component={OrdersScreen} options={{ title: 'Orders' }} />
      <OrdersStack.Screen name="OrderDetails" component={OrderDetailsScreen} options={{ title: 'Order Details' }} />
    </OrdersStack.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Orders" component={OrdersStackScreen} options={{ headerShown: false }} />
        <Tab.Screen name="Production" component={ProductionScreen} />
        <Tab.Screen name="Sales" component={SalesScreen} />
        <Tab.Screen name="Products" component={ProductsScreen} />
        <Tab.Screen name="Reports" component={ReportsScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}