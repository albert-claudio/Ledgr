import { colors } from '@/components/theme/colors';
import { typography } from '@/components/theme/typography';
import { useDailyQuests } from '@/hooks/useDailyQuests';
import { useAuth } from '@/providers/AuthProvider';
import { areAllQuestsComplete, getCompletedQuestsCount, getQuestInfo } from '@/services/quests';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { QuestCompletionCelebration } from './QuestCompletionCelebration';

export const DailyQuest = () => {
  const { user } = useAuth();
  const questsQuery = useDailyQuests(user?.id);
  
  // Ref para animar o badge de streak
  const streakScale = useRef(new Animated.Value(1)).current;
  
  // Estado para controlar visibilidade das quests durante animação
  const [hideQuests, setHideQuests] = React.useState(false);
  
  // Estado para controlar se deve mostrar a celebração
  const [showCelebration, setShowCelebration] = React.useState(false);
  const celebrationTriggered = useRef(false);

  console.log('[DailyQuest] Render:', {
    userId: user?.id,
    isLoading: questsQuery.isLoading,
    hasData: !!questsQuery.data,
    error: questsQuery.error,
    data: questsQuery.data,
  });

  if (!user?.id) return null;
  if (questsQuery.isLoading) return <DailyQuestSkeleton />;
  if (questsQuery.error) {
    console.error('[DailyQuest] Error:', questsQuery.error);
    return null;
  }
  if (!questsQuery.data) {
    console.warn('[DailyQuest] No data returned from query');
    return null;
  }

  const quests = questsQuery.data;
  const allComplete = areAllQuestsComplete(quests);
  const completedCount = getCompletedQuestsCount(quests);
  const totalQuests = quests.active_quests?.length || 2;

  // Efeito para ativar celebração apenas uma vez quando completar todas as quests
  // Persiste no AsyncStorage para não repetir mesmo fechando o app
  useEffect(() => {
    const checkAndShowCelebration = async () => {
      if (!allComplete || !questsQuery.data?.date || !user?.id) return;
      if (celebrationTriggered.current) return;
      
      try {
        // Chave única por dia E por usuário (YYYY-MM-DD + userId)
        const storageKey = `quest_celebration_shown_${user.id}_${questsQuery.data.date}`;
        const hasShown = await AsyncStorage.getItem(storageKey);
        
        // Se já mostrou hoje, não mostra novamente
        if (hasShown === 'true') {
          console.log('[DailyQuest] Celebration already shown today');
          return;
        }
        
        // Mostra celebração
        celebrationTriggered.current = true;
        setShowCelebration(true);
        
        // Persiste que já mostrou
        await AsyncStorage.setItem(storageKey, 'true');
        console.log('[DailyQuest] Celebration shown and persisted');
      } catch (error) {
        console.error('[DailyQuest] Error checking/saving celebration state:', error);
      }
    };
    
    checkAndShowCelebration();
  }, [allComplete, questsQuery.data?.date, user?.id]);

  // Callback para fazer o streak badge dar pop
  const handleStreakPop = () => {
    Animated.sequence([
      Animated.spring(streakScale, {
        toValue: 1.3,
        useNativeDriver: true,
        tension: 100,
        friction: 3,
      }),
      Animated.spring(streakScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 5,
      }),
    ]).start();
  };

  return (
    <View style={styles.card}>
      {/* Header com Streak */}
      <View style={styles.header}>
        <Text style={styles.title}>Missão do dia</Text>
        <Animated.View 
          style={[
            quests.current_streak > 0 ? styles.streakBadge : styles.streakBadgeDead,
            { transform: [{ scale: streakScale }] }
          ]}
        >
          <Text style={styles.streakEmoji}>
            {quests.current_streak > 0 ? '🔥' : '💀'}
          </Text>
          <Text style={quests.current_streak > 0 ? styles.streakText : styles.streakTextDead}>
            {quests.current_streak > 0 
              ? `${quests.current_streak} dia${quests.current_streak > 1 ? 's' : ''}`
              : 'Streak zerado'
            }
          </Text>
        </Animated.View>
      </View>

      {/* Subtitle */}
      {!hideQuests && (
        <>
          <Text style={styles.subtitle}>
            {allComplete 
              ? '🎉 Todas as missões completadas!'
              : `${completedCount}/${totalQuests} missões completadas`
            }
          </Text>
          
          {/* Mensagem quando perde o streak */}
          {quests.current_streak === 0 && quests.longest_streak > 0 && (
            <Text style={styles.streakLostText}>
              ⏰ Streak perdido! Complete as missões hoje para começar um novo.
            </Text>
          )}
        </>
      )}

      {/* Dynamic Quest List - Esconder durante animação */}
      {!hideQuests && (
        <View style={styles.questList}>
          {quests.active_quests?.map((questType) => {
            const questInfo = getQuestInfo(questType);
            return (
              <QuestItem
                key={questType}
                completed={quests[questType] === true}
                label={questInfo.label}
                icon={questInfo.icon}
              />
            );
          })}
        </View>
      )}

      {/* Streak Info */}
      {!hideQuests && quests.longest_streak > 0 && (
        <Text style={styles.recordText}>
          Recorde: {quests.longest_streak} dia{quests.longest_streak > 1 ? 's' : ''} seguido{quests.longest_streak > 1 ? 's' : ''}
        </Text>
      )}

      {/* Sequential Celebration Animation */}
      {showCelebration && (
        <QuestCompletionCelebration 
          currentStreak={quests.current_streak}
          onStreakPop={handleStreakPop}
          onAnimationStart={() => setHideQuests(true)}
          onAnimationEnd={() => setHideQuests(false)}
        />
      )}
    </View>
  );
};

// Quest Item Component com animação
interface QuestItemProps {
  completed: boolean;
  label: string;
  icon: string;
}

function QuestItem({ completed, label, icon }: QuestItemProps) {
  const scaleAnim = useRef(new Animated.Value(completed ? 1 : 0)).current;
  const opacityAnim = useRef(new Animated.Value(completed ? 1 : 0.5)).current;
  
  // Ref para garantir que a animação só roda uma vez
  const hasAnimated = useRef(completed);

  useEffect(() => {
    // Só anima se completou agora E ainda não animou antes
    if (completed && !hasAnimated.current) {
      hasAnimated.current = true;
      
      // Animação de "pop" quando completa
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.2,
          useNativeDriver: true,
          tension: 100,
          friction: 3,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 5,
        }),
      ]).start();

      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [completed, scaleAnim, opacityAnim]);

  return (
    <View style={styles.questItem}>
      <Animated.View
        style={[
          styles.checkbox,
          completed && styles.checkboxCompleted,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        {completed && <Text style={styles.checkmark}>✓</Text>}
      </Animated.View>
      
      <Text style={styles.questIcon}>{icon}</Text>
      
      <Animated.Text
        style={[
          styles.questLabel,
          completed && styles.questLabelCompleted,
          { opacity: opacityAnim },
        ]}
      >
        {label}
      </Animated.Text>
    </View>
  );
}

// Skeleton loader
function DailyQuestSkeleton() {
  return (
    <View style={[styles.card, styles.skeleton]}>
      <View style={[styles.skeletonBar, { width: '60%', height: 24 }]} />
      <View style={[styles.skeletonBar, { width: '40%', height: 16, marginTop: 8 }]} />
      <View style={{ marginTop: 16 }}>
        <View style={[styles.skeletonBar, { width: '100%', height: 40, marginBottom: 8 }]} />
        <View style={[styles.skeletonBar, { width: '100%', height: 40, marginBottom: 8 }]} />
        <View style={[styles.skeletonBar, { width: '100%', height: 40 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.button,
    shadowColor: colors.black,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    ...typography.header,
    color: colors.accent,
    fontSize: 20,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  streakEmoji: {
    fontSize: 14,
  },
  streakText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '700',
    fontSize: 12,
  },
  streakBadgeDead: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  streakTextDead: {
    ...typography.caption,
    color: colors.secondary,
    fontWeight: '600',
    fontSize: 12,
  },
  subtitle: {
    ...typography.body,
    color: colors.secondary,
    marginBottom: 16,
  },
  questList: {
    gap: 10,
  },
  questItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCompleted: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmark: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  questIcon: {
    fontSize: 20,
  },
  questLabel: {
    ...typography.body,
    color: colors.secondary,
    flex: 1,
  },
  questLabelCompleted: {
    color: colors.white,
    fontWeight: '600',
  },
  recordText: {
    ...typography.caption,
    color: colors.secondary,
    marginTop: 12,
    textAlign: 'center',
  },
  streakLostText: {
    ...typography.caption,
    color: colors.error || '#FF6B6B',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  skeleton: {
    opacity: 0.6,
  },
  skeletonBar: {
    backgroundColor: colors.border,
    borderRadius: 4,
  },
});
