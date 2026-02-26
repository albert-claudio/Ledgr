import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configurar handler de notificações (como elas aparecem quando o app está aberto)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const NOTIFICATION_ID_KEY = 'daily_quest_notification_id';

/**
 * Solicita permissão para enviar notificações
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission denied');
      return false;
    }

    // Configurar canal de notificação (Android)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('daily-quests', {
        name: 'Missões Diárias',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B00',
      });
    }

    console.log('[Notifications] Permission granted');
    return true;
  } catch (error) {
    console.error('[Notifications] Error requesting permissions:', error);
    return false;
  }
}

/**
 * Mensagens variadas para não ficar repetitivo
 */
const REMINDER_MESSAGES = [
  {
    title: '🔥 Não deixe o foguinho apagar!',
    body: 'Você completou 1 missão. Complete a outra para manter seu streak!',
  },
  {
    title: '🎮 Falta só mais uma!',
    body: 'Complete a última missão do dia e mantenha seu streak vivo!',
  },
  {
    title: '⚡ Metade do caminho!',
    body: 'Você está quase lá! Complete a última missão do dia.',
  },
];

/**
 * Calcula o delay inteligente para a notificação
 * @param delayMinutes - Delay em minutos (padrão: 3 minutos para teste, ou 120-240 para produção)
 */
function getSmartDelay(delayMinutes: number = 120): number {
  const now = new Date();
  const currentHour = now.getHours();
  
  // Se já é muito tarde (depois das 22h), agendar para amanhã 9h
  if (currentHour >= 22) {
    const tomorrow9am = new Date();
    tomorrow9am.setDate(tomorrow9am.getDate() + 1);
    tomorrow9am.setHours(9, 0, 0, 0);
    return Math.floor((tomorrow9am.getTime() - now.getTime()) / 1000);
  }
  
  // Se agendar ultrapassaria 22h, ajustar para 22h
  const scheduledTime = new Date(now.getTime() + delayMinutes * 60 * 1000);
  if (scheduledTime.getHours() >= 22) {
    const today10pm = new Date();
    today10pm.setHours(22, 0, 0, 0);
    return Math.floor((today10pm.getTime() - now.getTime()) / 1000);
  }
  
  // Caso normal: usar o delay especificado
  return delayMinutes * 60; // converter minutos para segundos
}

/**
 * Agenda uma notificação de lembrete para completar a segunda quest
 * @param delayMinutes - Delay em minutos (padrão: 3 para teste)
 */
export async function scheduleQuestReminder(delayMinutes: number = 120): Promise<string | null> {
  try {
    // Verifica permissão
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('[Notifications] No permission to schedule');
      return null;
    }

    // Cancela notificação anterior se existir
    await cancelQuestReminder();

    // Seleciona mensagem aleatória
    const message = REMINDER_MESSAGES[Math.floor(Math.random() * REMINDER_MESSAGES.length)];

    // Calcula delay inteligente
    const delaySeconds = getSmartDelay(delayMinutes);
    
    console.log(`[Notifications] Scheduling reminder in ${Math.floor(delaySeconds / 60)} minutes`);

    // Agenda a notificação
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: message.title,
        body: message.body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: { type: 'daily_quest_reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: delaySeconds,
        repeats: false,
      },
    });

    // Salva o ID para poder cancelar depois
    await AsyncStorage.setItem(NOTIFICATION_ID_KEY, notificationId);
    
    console.log('[Notifications] Reminder scheduled with ID:', notificationId);
    return notificationId;
  } catch (error) {
    console.error('[Notifications] Error scheduling reminder:', error);
    return null;
  }
}

/**
 * Cancela a notificação de lembrete agendada
 */
export async function cancelQuestReminder(): Promise<void> {
  try {
    const notificationId = await AsyncStorage.getItem(NOTIFICATION_ID_KEY);
    
    if (notificationId) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      await AsyncStorage.removeItem(NOTIFICATION_ID_KEY);
      console.log('[Notifications] Reminder cancelled:', notificationId);
    }
  } catch (error) {
    console.error('[Notifications] Error cancelling reminder:', error);
  }
}

/**
 * Verifica se há uma notificação agendada
 */
export async function hasScheduledReminder(): Promise<boolean> {
  try {
    const notificationId = await AsyncStorage.getItem(NOTIFICATION_ID_KEY);
    if (!notificationId) return false;

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.some(n => n.identifier === notificationId);
  } catch (error) {
    console.error('[Notifications] Error checking scheduled:', error);
    return false;
  }
}
