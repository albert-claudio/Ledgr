import { colors } from './colors';

export const tabBarStyles = {
  // Estilo principal da tab bar
  container: {
    backgroundColor: colors.background,
    borderTopColor: colors.background, // Remove linha superior
    borderTopWidth: 0,
    height: 65,
    paddingBottom: 10,
    paddingTop: 10,
    elevation: 0, // Remove sombra no Android
    shadowOpacity: 0, // Remove sombra no iOS
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
  },
  
  // Estilo dos labels
  label: {
    fontSize: 11,
    fontWeight: '500' as const,
    marginTop: 2,
    fontFamily: 'System', // ou sua fonte customizada
  },
  
  // Estilo dos ícones
  icon: {
    marginBottom: -2,
  },
  
  // Cores
  activeColor: colors.accent,    // Azul ciano para item ativo
  inactiveColor: '#9CA3AF',      // Cinza claro para itens inativos
  
  // Tamanhos dos ícones
  iconSizes: {
    default: 22,
    profile: 24, // Ícone de perfil um pouco maior
  }
};

// Configuração completa para usar no screenOptions
export const tabBarScreenOptions = {
  tabBarActiveTintColor: tabBarStyles.activeColor,
  tabBarInactiveTintColor: tabBarStyles.inactiveColor,
  tabBarStyle: tabBarStyles.container,
  tabBarLabelStyle: tabBarStyles.label,
  tabBarIconStyle: tabBarStyles.icon,
  headerShown: false,
};