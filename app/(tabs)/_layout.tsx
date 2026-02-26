import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { tabBarScreenOptions, tabBarStyles } from '../../components/theme/tabBarStyles';

export default function TabLayout() {
  return (
    <Tabs screenOptions={tabBarScreenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? 'home' : 'home-outline'} 
              size={tabBarStyles.iconSizes.default} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Buscar',
          tabBarIcon: ({ color }) => (
            <Ionicons 
              name="search-outline" 
              size={tabBarStyles.iconSizes.default} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: 'Minha Coleção',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? 'bookmark' : 'bookmark-outline'} 
              size={tabBarStyles.iconSizes.default} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? 'person-circle' : 'person-circle-outline'} 
              size={tabBarStyles.iconSizes.profile} 
              color={color} 
            />
          ),
        }}
      />
    </Tabs>
  );
}