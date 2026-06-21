import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FALLBACK = '—'
const SENDER_DOMAIN = Deno.env.get('SENDER_DOMAIN') ?? 'notify.mbrqc.com.br'
const FROM_ADDR = 'informacao@mbrqc.com.br'

const AREA_LABEL: Record<string, string> = {
  cp: 'CP', bp: 'BP', ch: 'CH', oem: 'OEM',
  incoming: 'Incoming', pintura: 'Pintura', injecao: 'Injeção',
  sala_audio: 'Sala do Áudio', inspecao_peca: 'Inspeção de Peça',
}

function escapeHtml(v: unknown): string {
  if (v === null || v === undefined || v === '') return FALLBACK
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
function replaceVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
    const val = vars[k]
    if (val === undefined || val === null || val === '') return FALLBACK
    return val
  })
}
function fmtDate(d: string | null | undefined) {
  if (!d) return FALLBACK
  const dt = new Date(String(d).length === 10 ? d + 'T12:00:00' : d)
  if (isNaN(dt.getTime())) return FALLBACK
  return dt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}
function todayInTz(tz = 'America/Sao_Paulo') {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: tz }))
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return { dateBR: d.toLocaleDateString('pt-BR'), dayStr: `${y}-${m}-${day}`, today: d }
}

function buildHtml(vencidos: any[], aVencer: any[], message: string, period: string, dateBR: string, dias: number) {
  const renderRow = (r: any, vencido: boolean) => `<tr>
    <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(r.full_name)}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#64748b;">${escapeHtml(AREA_LABEL[r.area] ?? r.area)}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;${vencido ? 'color:#dc2626;font-weight:600;' : ''}">${fmtDate(r.next_evaluation_date)}</td>
  </tr>`

  const section = (title: string, items: any[], vencido: boolean, accent: string) => `
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-top:16px;overflow:auto;">
      <h2 style="margin:0 0 12px;font-size:14px;color:${accent};display:flex;align-items:center;gap:8px;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${accent};"></span>
        ${escapeHtml(title)} <span style="color:#64748b;font-weight:400;">(${items.length})</span>
      </h2>
      ${items.length === 0
        ? '<p style="margin:0;color:#64748b;font-style:italic;font-size:13px;">Nenhum registro.</p>'
        : `<table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead><tr style="background:#f8fafc;text-align:left;">
              <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;">Inspetor</th>
              <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;">Área</th>
              <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;">Próxima avaliação</th>
            </tr></thead>
            <tbody>${items.map((it: any) => renderRow(it, vencido)).join('')}</tbody>
          </table>`}
    </div>`

  return `<!doctype html><html><head><meta charset="utf-8"><title>Matriz — Resumo Semanal</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'DM Sans',Arial,sans-serif;color:#0f172a;">
  <div style="max-width:760px;margin:0 auto;padding:24px;">
    <div style="background:#7c3aed;color:#fff;border-radius:12px;padding:24px;">
      <div style="font-size:12px;opacity:.7;text-transform:uppercase;letter-spacing:.1em;">MBR Quality • Matriz de Versatilidade</div>
      <h1 style="margin:8px 0 4px;font-size:22px;font-weight:700;">Resumo Semanal</h1>
      <div style="font-size:13px;opacity:.85;">${escapeHtml(period)}</div>
    </div>
    ${message ? `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-top:16px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</div>` : ''}
    <div style="display:flex;gap:12px;margin-top:16px;flex-wrap:wrap;">
      <div style="flex:1;min-width:160px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Vencidos</div>
        <div style="font-size:28px;font-weight:700;color:#dc2626;margin-top:4px;">${vencidos.length}</div>
      </div>
      <div style="flex:1;min-width:160px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">A vencer (${dias} dias)</div>
        <div style="font-size:28px;font-weight:700;color:#d97706;margin-top:4px;">${aVencer.length}</div>
      </div>
    </div>
    ${section('Vencidos', vencidos, true, '#dc2626')}
    ${section('A vencer', aVencer, false, '#d97706')}
    <p style="text-align:center;font-size:11px;color:#94a3b8;margin:24px 0 0;">MBR Quality — Envio automatizado • ${escapeHtml(dateBR)}</p>
  </div>
</body></html>`
}

async function buildMatrizData(supabase: any, dias: number) {
  const { data: quals } = await supabase.from('inspector_qualifications').select('user_id, area, next_evaluation_date').eq('habilitado', true)
  const list = quals ?? []
  if (list.length === 0) return { vencidos: [], aVencer: [] }
  const ids = [...new Set(list.map((r: any) => r.user_id))]
  const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids)
  const nameMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]))

  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  today.setHours(0, 0, 0, 0)
  const limit = new Date(today)
  limit.setDate(limit.getDate() + dias)

  const vencidos: any[] = []
  const aVencer: any[] = []
  for (const r of list) {
    if (!r.next_evaluation_date) continue
    const d = new Date(r.next_evaluation_date + 'T12:00:00')
    const enriched = { ...r, full_name: nameMap.get(r.user_id) ?? '—' }
    if (d < today) vencidos.push(enriched)
    else if (d <= limit) aVencer.push(enriched)
  }
  return { vencidos, aVencer }
}

async function notifyError(supabase: any, config: any, configId: string, reason: string, dayStr: string, logId: string | null) {
  try {
    const adminList: string[] = (config?.error_notify_recipients?.length ? config.error_notify_recipients : config?.recipients) ?? []
    if (adminList.length === 0) return
    const subject = `[MBR Quality] FALHA — ${config?.name ?? configId}`
    const html = `<!doctype html><body style="font-family:Arial,sans-serif;padding:24px;color:#0f172a;">
      <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #fecaca;border-radius:12px;padding:24px;">
        <div style="background:#dc2626;color:#fff;padding:12px;border-radius:8px;margin-bottom:16px;font-weight:600;">⚠️ Falha na automação de e-mails (Matriz)</div>
        <p><strong>Automação:</strong> ${escapeHtml(config?.name ?? '—')}</p>
        <p><strong>Config ID:</strong> <code>${escapeHtml(configId)}</code></p>
        <p><strong>Data:</strong> ${escapeHtml(dayStr)}</p>
        ${logId ? `<p><strong>Log ID:</strong> <code>${escapeHtml(logId)}</code></p>` : ''}
        <p><strong>Motivo:</strong></p>
        <pre style="background:#fef2f2;color:#7f1d1d;padding:12px;border-radius:8px;white-space:pre-wrap;font-size:12px;border:1px solid #fecaca;">${escapeHtml(reason)}</pre>
      </div></body>`
    for (const to of adminList) {
      await supabase.rpc('enqueue_email', {
        queue_name: 'transactional_emails',
        payload: {
          to, from: FROM_ADDR, sender_domain: SENDER_DOMAIN, subject, html,
          purpose: 'transactional', label: 'matriz-automation-error',
          idempotency_key: `err-matriz-${configId}-${dayStr}-${logId ?? 'noLog'}-${to}`,
          message_id: crypto.randomUUID(), queued_at: new Date().toISOString(),
        },
      })
    }
    if (logId) await supabase.from('email_automation_log').update({ error_notified: true }).eq('id', logId)
  } catch (e) { console.error('notifyError failed', e) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  let body: any = {}
  let configCached: any = null
  let dayStrCached = ''
  let logIdInProgress: string | null = null

  try {
    body = await req.json().catch(() => ({}))
    const { config_id, log_id, test_to, preview, draft, resend } = body as any
    if (!config_id) {
      return new Response(JSON.stringify({ error: 'config_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    logIdInProgress = log_id ?? null

    const { data: config, error: cfgErr } = await supabase
      .from('email_automation_config').select('*').eq('id', config_id).single()
    if (cfgErr || !config) throw new Error('Configuração não encontrada')
    configCached = config

    const { dateBR, dayStr } = todayInTz(config.timezone || 'America/Sao_Paulo')
    dayStrCached = dayStr
    const isReal = !preview && !test_to && !draft && !resend

    const dias = Math.max(1, Number((config.metadata as any)?.dias_antecedencia ?? 30))

    if (isReal) {
      const { data: existing } = await supabase.from('email_automation_log')
        .select('id').eq('config_id', config.id).eq('send_date', dayStr)
        .in('trigger_type', ['scheduled', 'manual'])
        .in('status', ['queued', 'sent', 'pending']).maybeSingle()
      if (existing && (!log_id || existing.id !== log_id)) {
        return new Response(JSON.stringify({ ok: true, skipped: 'already_sent_today', existing_log_id: existing.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    const { vencidos, aVencer } = await buildMatrizData(supabase, dias)
    const period = `Semana até ${dateBR}`
    const vars: Record<string, string> = {
      date: dateBR, period,
      total_vencidos: String(vencidos.length),
      total_vencer: String(aVencer.length),
      dias_antecedencia: String(dias),
    }
    const subject = replaceVars(config.subject_template || 'Matriz — Resumo Semanal {{date}}', vars)
    const messageBody = replaceVars(config.message_body || '', vars)
    const html = buildHtml(vencidos, aVencer, messageBody, period, dateBR, dias)

    if (preview) {
      return new Response(JSON.stringify({ ok: true, preview: true, subject, html, total_vencidos: vencidos.length, total_vencer: aVencer.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (draft) {
      const { data: ins } = await supabase.from('email_automation_log').insert({
        config_id: config.id, modulo: 'matriz', tipo_disparo: 'agendado',
        trigger_type: 'draft', status: 'draft', recipients: config.recipients ?? [],
        subject, preview_html: html, send_date: dayStr,
      }).select('id').single()
      return new Response(JSON.stringify({ ok: true, draft: true, draft_id: ins?.id, subject, html }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const ccList: string[] = Array.isArray((config as any)?.metadata?.cc) ? (config as any).metadata.cc.filter(Boolean) : []
    const recipients: string[] = test_to ? [test_to] : Array.from(new Set([...(config.recipients ?? []), ...ccList].filter(Boolean)))
    if (recipients.length === 0) throw new Error('Sem destinatários configurados')

    const triggerSuffix = resend ? `-r${Date.now()}` : (test_to ? `-test-${Date.now()}` : '')
    for (const to of recipients) {
      await supabase.rpc('enqueue_email', {
        queue_name: 'transactional_emails',
        payload: {
          to, from: FROM_ADDR, sender_domain: SENDER_DOMAIN, subject, html,
          purpose: 'transactional', label: 'matriz-weekly',
          idempotency_key: `matriz-${config.id}-${dayStr}-${to}${triggerSuffix}`,
          message_id: crypto.randomUUID(), queued_at: new Date().toISOString(),
        },
      })
    }

    if (log_id) {
      await supabase.from('email_automation_log').update({
        status: 'queued', recipients, subject, send_date: dayStr,
      }).eq('id', log_id)
    } else {
      await supabase.from('email_automation_log').insert({
        config_id: config.id, modulo: 'matriz', tipo_disparo: 'agendado',
        trigger_type: test_to ? 'test' : (resend ? 'manual' : 'scheduled'),
        status: 'queued', recipients, subject, send_date: dayStr,
      })
    }
    if (!test_to && !resend) {
      await supabase.from('email_automation_config').update({ last_sent_at: new Date().toISOString() }).eq('id', config.id)
    }
    return new Response(JSON.stringify({ ok: true, queued: recipients.length, subject }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('send-matriz-email error', msg)
    try {
      if (logIdInProgress) {
        await supabase.from('email_automation_log').update({
          status: 'failed', error_message: msg.slice(0, 1000),
        }).eq('id', logIdInProgress)
      } else if (body?.config_id && !body?.preview && !body?.draft) {
        await supabase.from('email_automation_log').insert({
          config_id: body.config_id, modulo: 'matriz', tipo_disparo: 'agendado',
          trigger_type: body?.test_to ? 'test' : 'manual',
          recipients: body?.test_to ? [body.test_to] : [],
          status: 'failed', error_message: msg.slice(0, 1000),
          send_date: dayStrCached || null,
        })
      }
      if (configCached && body?.config_id && !body?.preview && !body?.draft) {
        await notifyError(supabase, configCached, body.config_id, msg, dayStrCached, logIdInProgress)
      }
    } catch (logErr) { console.error('failed to log error', logErr) }
    return new Response(JSON.stringify({ error: msg, config_id: body?.config_id ?? null }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
