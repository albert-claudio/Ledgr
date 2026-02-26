import { colors } from '@/components/theme/colors';
import { typography } from '@/components/theme/typography';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  currentStreak: number;
  onStreakPop?: () => void;
  onAnimationStart?: () => void;
  onAnimationEnd?: () => void;
}

/**
 * Animação sequencial de celebração quando completar todas as quests
 * 
 * Sequência (Storytelling):
 * 1. Estado Inicial (0s): "Todas as missões completadas!"
 * 2. Delay 1.5s: Fade out up + Fade in down para "+50 Ledgr Points"
 * 3. Delay 3.5s: Muda para "Nível 1: Novato" com box de benefícios
 * 4. Delay 5.5s: Dispara callback para streak icon fazer pop
 */
export function QuestCompletionCelebration({ currentStreak, onStreakPop, onAnimationStart, onAnimationEnd }: Props) {
  // Estado do stage (0 = inicial, 1 = points, 2 = level)
  const [stage, setStage] = useState(0);
  
  // Ref para garantir que a animação só roda uma vez
  const hasRun = useRef(false);
  
  // Animações de texto
  const textOpacity = useSharedValue(1);
  const textTranslateY = useSharedValue(0);
  
  // Animação do box de benefícios
  const boxOpacity = useSharedValue(0);
  const boxScale = useSharedValue(0.8);

  useEffect(() => {
    // Se já rodou, não executa novamente (proteção extra)
    if (hasRun.current) return;
    hasRun.current = true;

    // Notifica que a animação começou
    if (onAnimationStart) {
      onAnimationStart();
    }

    // Funções para mudar stage (wrapped para runOnJS)
    const goToStage1 = () => {
      setStage(1);
      textTranslateY.value = 20;
      textOpacity.value = withTiming(1, { duration: 400 });
      textTranslateY.value = withSpring(0, { damping: 12 });
    };

    const goToStage2 = () => {
      setStage(2);
      textTranslateY.value = 20;
      textOpacity.value = withTiming(1, { duration: 400 });
      textTranslateY.value = withSpring(0, { damping: 12 });
      
      // Animar box de benefícios
      boxOpacity.value = withDelay(200, withTiming(1, { duration: 500 }));
      boxScale.value = withDelay(200, withSpring(1, { damping: 10 }));
    };

    // Sequência de animações
    const runSequence = async () => {
      // Stage 0: Inicial (fica 1.5s)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Stage 1: Transição para Points
      textOpacity.value = withTiming(0, { duration: 300 }, (finished) => {
        if (finished) {
          runOnJS(goToStage1)();
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Fica 2s mostrando points
      
      // Stage 2: Transição para Level
      textOpacity.value = withTiming(0, { duration: 300 }, (finished) => {
        if (finished) {
          runOnJS(goToStage2)();
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Fica 2s mostrando level
      
      // Stage 3: Disparar streak pop
      if (onStreakPop) {
        onStreakPop();
      }

      // Aguarda mais 1 segundo e finaliza animação
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Notifica que a animação terminou
      if (onAnimationEnd) {
        onAnimationEnd();
      }
      
      // Mantém o estado final (stage 2) visível
    };
    
    runSequence();
  }, []); // Array vazio - só roda uma vez no mount

  // Estilo animado do texto principal
  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  // Estilo animado do box de benefícios
  const boxAnimatedStyle = useAnimatedStyle(() => ({
    opacity: boxOpacity.value,
    transform: [{ scale: boxScale.value }],
  }));

  // Renderizar conteúdo baseado no stage
  const renderContent = () => {
    switch (stage) {
      case 0:
        return (
          <Animated.View style={[styles.content, textAnimatedStyle]}>
            <Text style={styles.mainText}>🎉 Todas as missões completadas! 🎉</Text>
          </Animated.View>
        );
      
      case 1:
        return (
          <Animated.View style={[styles.content, textAnimatedStyle]}>
            <Text style={styles.pointsText}>+50</Text>
            <Text style={styles.pointsLabel}>Ledgr Points</Text>
          </Animated.View>
        );
      
      case 2:
        return (
          <View style={styles.content}>
            <Animated.View style={textAnimatedStyle}>
              <Text style={styles.levelText}>Nível 1: Novato</Text>
            </Animated.View>
            
            <Animated.View style={[styles.benefitsBox, boxAnimatedStyle]}>
              <View style={styles.benefitRow}>
                <Text style={styles.benefitIcon}>✨</Text>
                <Text style={styles.benefitText}>Desbloqueou conquistas básicas</Text>
              </View>
              <View style={styles.benefitRow}>
                <Text style={styles.benefitIcon}>🎮</Text>
                <Text style={styles.benefitText}>Continue completando quests para subir de nível!</Text>
              </View>
            </Animated.View>
          </View>
        );
      
      default:
        return null;
    }
  };

  return (
    <View style={styles.container} pointerEvents="none">
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  mainText: {
    ...typography.body,
    fontSize: 18,
    fontWeight: '700',
    color: colors.accent,
    textAlign: 'center',
  },
  pointsText: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.accent,
    textAlign: 'center',
  },
  pointsLabel: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '600',
    color: colors.secondary,
    marginTop: 4,
  },
  levelText: {
    ...typography.body,
    fontSize: 20,
    fontWeight: '700',
    color: colors.accent,
    textAlign: 'center',
    marginBottom: 12,
  },
  benefitsBox: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.accent + '30',
    width: '100%',
    gap: 12,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitIcon: {
    fontSize: 20,
  },
  benefitText: {
    ...typography.body,
    color: colors.secondary,
    flex: 1,
    fontSize: 14,
  },
});

