export function steamErrorMessage(err: any) {
  if (!err) return 'Não foi possível sincronizar com a Steam no momento.';
  const code = (err as any)?.code;
  if (code === 'steam_api_key_missing') {
    return 'Configuração do servidor ausente: defina STEAM_API_KEY nas Edge Functions do Supabase.';
  }
  if (code === 'steamid_missing') {
    return 'Conta Steam não vinculada ainda. Tente novamente em alguns segundos.';
  }
  if (code === 'steam_profile_private') {
    return 'Seu perfil Steam precisa estar público (Game details) para importar os jogos.';
  }
  if (typeof err?.message === 'string' && err.message.trim()) {
    return err.message;
  }
  if (typeof err === 'string' && err.trim()) {
    return err;
  }
  return 'Não foi possível sincronizar com a Steam no momento.';
}
