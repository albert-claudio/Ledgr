# Configuração do Cron Job - Daily Quests Reset

Este guia mostra como configurar o Cron Job no Supabase para resetar automaticamente streaks de usuários inativos à meia-noite (horário de Brasília).

## 📋 Pré-requisitos

- Acesso ao Dashboard do Supabase
- Migration `20251209000000_reset_inactive_streaks.sql` aplicada

## 🔧 Passo a Passo

### 1. Ativar Extensão pg_cron

1. Acesse o **Supabase Dashboard**
2. Vá em **Database** > **Extensions**
3. Procure por `pg_cron`
4. Clique em **Enable** se ainda não estiver ativo

### 2. Criar o Cron Job

No **SQL Editor**, execute o seguinte comando:

```sql
SELECT cron.schedule(
  'reset-inactive-streaks-daily',           -- Nome do job
  '0 3 * * *',                               -- Schedule: 3h AM UTC = meia-noite Brasília (UTC-3)
  $$SELECT public.reset_inactive_streaks();$$
);
```

> **Nota**: O horário `0 3 * * *` significa **3h AM UTC**, que equivale a **meia-noite (00:00)** no horário de Brasília (UTC-3).

### 3. Verificar se o Job foi Criado

```sql
SELECT * FROM cron.job WHERE jobname = 'reset-inactive-streaks-daily';
```

Você deve ver uma linha com:

- `jobname`: `reset-inactive-streaks-daily`
- `schedule`: `0 3 * * *`
- `active`: `true`

### 4. Monitorar Execuções

Para ver as últimas 10 execuções do job:

```sql
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'reset-inactive-streaks-daily')
ORDER BY start_time DESC
LIMIT 10;
```

### 5. Testar Manualmente (Opcional)

Para testar a função sem esperar a meia-noite:

```sql
SELECT public.reset_inactive_streaks();
```

Isso vai resetar imediatamente todos os streaks de usuários que não completaram quests ontem.

## 🗑️ Remover o Job (Se Necessário)

Se precisar deletar o Cron Job:

```sql
SELECT cron.unschedule('reset-inactive-streaks-daily');
```

## ✅ Verificação Final

Após configurar, o sistema deve:

- Rodar automaticamente todos os dias à meia-noite (horário Brasília)
- Resetar `current_streak = 0` para usuários que pularam um dia
- Registrar logs no `cron.job_run_details`

## 📝 Notas Importantes

- A função usa `timezone('America/Sao_Paulo', now())` para garantir consistência com horário de Brasília
- Usuários que perderam o streak verão a mensagem "⏰ Streak perdido!" ao abrir o app
- O `longest_streak` NUNCA é resetado, apenas o `current_streak`
