import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Runs every 5 min via pg_cron. For each enabled config, fires send-automation-email
// when current local time crosses the schedule_time and weekday matches, once per day.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  try {
    const { data: configs, error } = await supabase
      .from('email_automation_config')
      .select('*')
      .eq('enabled', true)
    if (error) throw error

    const triggered: string[] = []
    const skipped: Array<{ id: string; reason: string }> = []

    for (const cfg of configs ?? []) {
      const tz = cfg.timezone || 'America/Sao_Paulo'
      const nowLocal = new Date(new Date().toLocaleString('en-US', { timeZone: tz }))
      const weekday = nowLocal.getDay() // 0=Sun..6=Sat
      const weekdays: number[] = cfg.weekdays ?? []
      if (!weekdays.includes(weekday)) {
        skipped.push({ id: cfg.id, reason: 'weekday' })
        continue
      }

      // Parse schedule_time HH:MM(:SS)
      const [hh, mm] = String(cfg.schedule_time).split(':').map(Number)
      const scheduleMinutes = hh * 60 + mm
      const nowMinutes = nowLocal.getHours() * 60 + nowLocal.getMinutes()
      const diff = nowMinutes - scheduleMinutes
      // Fire window: between schedule_time and schedule_time + 10 min
      if (diff < 0 || diff > 10) {
        skipped.push({ id: cfg.id, reason: 'time_window' })
        continue
      }

      // Already sent today?
      if (cfg.last_sent_at) {
        const last = new Date(new Date(cfg.last_sent_at).toLocaleString('en-US', { timeZone: tz }))
        if (
          last.getFullYear() === nowLocal.getFullYear() &&
          last.getMonth() === nowLocal.getMonth() &&
          last.getDate() === nowLocal.getDate()
        ) {
          skipped.push({ id: cfg.id, reason: 'already_sent_today' })
          continue
        }
      }

      // Already sent today? (defensive — send-automation-email also checks)
      const dayY = nowLocal.getFullYear()
      const dayM = String(nowLocal.getMonth() + 1).padStart(2, '0')
      const dayD = String(nowLocal.getDate()).padStart(2, '0')
      const dayStr = `${dayY}-${dayM}-${dayD}`
      const { data: existing } = await supabase
        .from('email_automation_log')
        .select('id')
        .eq('config_id', cfg.id)
        .eq('send_date', dayStr)
        .in('trigger_type', ['scheduled', 'manual'])
        .in('status', ['queued', 'sent', 'pending'])
        .maybeSingle()
      if (existing) {
        skipped.push({ id: cfg.id, reason: 'already_sent_today' })
        continue
      }

      // Create a log row up-front (idempotency index prevents duplicates)
      const { data: logRow, error: logErr } = await supabase
        .from('email_automation_log')
        .insert({
          config_id: cfg.id,
          trigger_type: 'scheduled',
          recipients: cfg.recipients ?? [],
          status: 'pending',
          send_date: dayStr,
        })
        .select('id')
        .single()

      if (logErr) {
        skipped.push({ id: cfg.id, reason: `log_insert: ${logErr.message.slice(0, 200)}` })
        continue
      }

      // Invoke sender (fire and forget)
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-automation-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ config_id: cfg.id, log_id: logRow?.id }),
      })

      if (!resp.ok) {
        const errText = await resp.text()
        if (logRow?.id) {
          await supabase
            .from('email_automation_log')
            .update({ status: 'failed', error_message: errText.slice(0, 1000) })
            .eq('id', logRow.id)
        }
        // Notify admins about scheduler-level failure
        try {
          const adminList: string[] = (cfg.error_notify_recipients?.length ? cfg.error_notify_recipients : cfg.recipients) ?? []
          for (const to of adminList) {
            await supabase.rpc('enqueue_email', {
              queue_name: 'transactional_emails',
              payload: {
                to, from: 'informacao@mbrqc.com.br',
                sender_domain: Deno.env.get('SENDER_DOMAIN') ?? 'notify.mbrqc.com.br',
                subject: `[MBR Quality] FALHA agendada — ${cfg.name ?? cfg.id}`,
                html: `<p><strong>Agendamento falhou.</strong></p>
                       <p><strong>Config:</strong> ${cfg.name ?? ''} (<code>${cfg.id}</code>)</p>
                       <p><strong>Data:</strong> ${dayStr}</p>
                       <p><strong>Motivo:</strong></p>
                       <pre style="background:#fef2f2;padding:12px;border-radius:6px;white-space:pre-wrap;">${errText.slice(0, 1000).replace(/</g, '&lt;')}</pre>`,
                purpose: 'transactional',
                label: 'ng-automation-error',
                idempotency_key: `schederr-${cfg.id}-${dayStr}-${to}`,
                message_id: crypto.randomUUID(),
                queued_at: new Date().toISOString(),
              },
            })
          }
          if (logRow?.id) {
            await supabase.from('email_automation_log').update({ error_notified: true }).eq('id', logRow.id)
          }
        } catch (notifyErr) {
          console.error('notify failed', notifyErr)
        }
        skipped.push({ id: cfg.id, reason: `send_error: ${errText.slice(0, 200)}` })
        continue
      }

      triggered.push(cfg.id)
    }

    return new Response(
      JSON.stringify({ ok: true, triggered, skipped, checked: configs?.length ?? 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('scheduler error', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
