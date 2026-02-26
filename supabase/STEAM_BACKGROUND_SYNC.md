# Configuração do Cron Job - Steam Background Sync

Este guia mostra como configurar o Cron Job no Supabase para sincronizar automaticamente a Steam em segundo plano, mesmo quando o app está fechado.

## 📋 Por que isso é importante?

Com a sincronização em segundo plano:

- ✅ **Celular desligado?** Sem problema! O servidor sincroniza automaticamente
- ✅ **App fechado?** Os jogos são sincronizados a cada 4 horas
- ✅ **Abriu o app?** A timeline já mostra os últimos jogos jogados

## 🔧 Passo a Passo

### 1. Ativar Extensão pg_cron

1. Acesse o **Supabase Dashboard**
2. Vá em **Database** > **Extensions**
3. Procure por `pg_cron`
4. Clique em **Enable** se ainda não estiver ativo

> ⚠️ **Importante**: pg_cron está disponível nos planos **Pro** e superiores do Supabase.

### 2. Ativar Extensão pg_net

1. Na mesma página de Extensions
2. Procure por `pg_net`
3. Clique em **Enable** se ainda não estiver ativo

### 3. Criar o Cron Job

No **SQL Editor**, execute o seguinte comando:

> ⚠️ **IMPORTANTE**: Substitua `[PROJECT_ID]` e `[SERVICE_ROLE_KEY]` pelos seus valores reais!
>
> - **PROJECT_ID**: Encontre em **Project Settings > General** (ex: `abc123xyz`)
> - **SERVICE_ROLE_KEY**: Encontre em **Project Settings > API > service_role key**

```sql
-- Remover job antigo se existir
SELECT cron.unschedule('steam-background-sync');

-- Criar novo job
SELECT cron.schedule(
  'steam-background-sync',
  '0 */4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://[PROJECT_ID].supabase.co/functions/v1/steam_sync_scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer [SERVICE_ROLE_KEY]'
    ),
    body := '{"source": "cron"}'::jsonb
  );
  $$
);
```

> **Nota**: O horário `0 */4 * * *` significa a cada 4 horas (00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC).

### 4. Verificar se o Job foi Criado

```sql
SELECT * FROM cron.job WHERE jobname = 'steam-background-sync';
```

Você deve ver uma linha com:

- `jobname`: `steam-background-sync`
- `schedule`: `0 */4 * * *`
- `active`: `true`

### 5. Monitorar Execuções

Para ver as últimas 10 execuções do job:

```sql
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'steam-background-sync')
ORDER BY start_time DESC
LIMIT 10;
```

## 🆓 Alternativa para Plano Free

Se você está no plano Free do Supabase (sem pg_cron), use uma alternativa externa:

### Opção 1: GitHub Actions (Gratuito)

Crie `.github/workflows/steam-sync.yml`:

```yaml
name: Steam Background Sync
on:
  schedule:
    - cron: "0 */4 * * *" # A cada 4 horas
  workflow_dispatch: # Manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Steam Sync
        run: |
          curl -X POST '${{ secrets.SUPABASE_URL }}/functions/v1/steam_sync_scheduler' \
            -H 'Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}' \
            -H 'Content-Type: application/json' \
            -d '{"source": "github-actions"}'
```

### Opção 2: cron-job.org (Gratuito)

1. Acesse [cron-job.org](https://cron-job.org/)
2. Crie uma conta gratuita
3. Adicione um novo cron job:
   - **URL**: `https://[PROJECT_ID].supabase.co/functions/v1/steam_sync_scheduler`
   - **Schedule**: `*/240 * * * *` (a cada 4 horas)
   - **Request Method**: POST
   - **Headers**:
     - `Authorization: Bearer [SERVICE_ROLE_KEY]`
     - `Content-Type: application/json`
   - **Body**: `{"source": "cron-job-org"}`

## 🗑️ Remover o Job (Se Necessário)

```sql
SELECT cron.unschedule('steam-background-sync');
```

## ✅ Verificação Final

Após configurar, o sistema deve:

- ✅ Sincronizar automaticamente a cada 4 horas
- ✅ Processar até 100 contas por execução (prioridade para quem não sincronizou há mais tempo)
- ✅ Atualizar a timeline com jogos do dia
- ✅ Agrupar múltiplas sessões do mesmo jogo no mesmo dia

## 📝 Logs e Debug

Para ver os logs da Edge Function no Supabase:

1. Vá em **Edge Functions** > **steam_sync_scheduler**
2. Clique na aba **Logs**
3. Filtre por horário para ver as execuções do cron

Os logs mostrarão:

- Quantas contas foram processadas
- Quais jobs foram criados
- Erros (se houver)
