import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_CURRENT = 'steam-auth-state';
const STORAGE_KEY_LEGACY = 'steam-link-state';

type StoredSteamAuthState = {
  state: string;
  requestedAt: number;
};

export async function saveSteamAuthState(state: string) {
  const payload: StoredSteamAuthState = { state, requestedAt: Date.now() };
  await AsyncStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify(payload));
}

export async function getSteamAuthState(): Promise<StoredSteamAuthState | null> {
  try {
    // Try current key first
    const raw = await AsyncStorage.getItem(STORAGE_KEY_CURRENT);
    if (raw) return JSON.parse(raw) as StoredSteamAuthState;
    // Fallback to legacy key for backward compatibility
    const legacy = await AsyncStorage.getItem(STORAGE_KEY_LEGACY);
    if (!legacy) return null;
    const parsed = JSON.parse(legacy) as StoredSteamAuthState;
    // Migrate once
    try { await AsyncStorage.setItem(STORAGE_KEY_CURRENT, legacy); } catch {}
    try { await AsyncStorage.removeItem(STORAGE_KEY_LEGACY); } catch {}
    return parsed;
  } catch {
    return null;
  }
}

export async function clearSteamAuthState() {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY_CURRENT);
    await AsyncStorage.removeItem(STORAGE_KEY_LEGACY);
  } catch {
    // ignore
  }
}
