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

      // Create a log row up-front so we can update it
      const { data: logRow } = await supabase
        .from('email_automation_log')
        .insert({
          config_id: cfg.id,
          trigger_type: 'scheduled',
          recipients: cfg.recipients ?? [],
          status: 'pending',
        })
        .select('id')
        .single()

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
