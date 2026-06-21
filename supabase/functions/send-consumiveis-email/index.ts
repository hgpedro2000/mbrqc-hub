import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FALLBACK = '—'
const APP_URL = Deno.env.get('APP_PUBLIC_URL') ?? 'https://mbrquality.lovable.app'
const SENDER_DOMAIN = Deno.env.get('SENDER_DOMAIN') ?? 'notify.mbrqc.com.br'
const FROM_ADDR = 'informacao@mbrqc.com.br'

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
function todayInTz(tz = 'America/Sao_Paulo') {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: tz }))
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return { dateBR: d.toLocaleDateString('pt-BR'), dayStr: `${y}-${m}-${day}` }
}

function shellHtml(title: string, accent: string, badge: string, bodyInner: string, dateBR: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'DM Sans',Arial,sans-serif;color:#0f172a;">
  <div style="max-width:760px;margin:0 auto;padding:24px;">
    <div style="background:${accent};color:#fff;border-radius:12px;padding:20px;">
      <div style="font-size:12px;opacity:.85;text-transform:uppercase;letter-spacing:.1em;">MBR Quality • Consumíveis</div>
      <h1 style="margin:8px 0 4px;font-size:22px;font-weight:700;">${escapeHtml(badge)}</h1>
      <div style="font-size:13px;opacity:.9;">${escapeHtml(title)}</div>
    </div>
    ${bodyInner}
    <p style="text-align:center;font-size:11px;color:#94a3b8;margin:24px 0 0;">MBR Quality — Envio automatizado • ${escapeHtml(dateBR)}</p>
  </div>
</body></html>`
}

function detailsTable(rows: Array<[string, any]>) {
  return `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-top:16px;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      ${rows.map(([k, v]) => `<tr>
        <td style="padding:6px 0;color:#64748b;width:160px;">${k}</td>
        <td style="padding:6px 0;font-weight:500;">${escapeHtml(v)}</td>
      </tr>`).join('')}
    </table></div>`
}

function messageCard(msg: string) {
  if (!msg) return ''
  return `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-top:16px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(msg)}</div>`
}

function buildRequestHtml(req: any, message: string, dateBR: string) {
  return shellHtml(
    `Solicitação #${req.numero ?? ''}`,
    '#2563eb',
    `🛒 Nova solicitação #${req.numero ?? ''}`,
    messageCard(message) + detailsTable([
      ['Item', req.item_name],
      ['Quantidade', req.quantity],
      ['Solicitante', req.user_name],
      ['Turno', req.turno],
      ['Status', req.status],
    ]),
    dateBR,
  )
}

function buildLowStockHtml(item: any, message: string, dateBR: string) {
  return shellHtml(
    `Estoque baixo — ${item.name}`,
    '#dc2626',
    `⚠️ ${item.name} abaixo do mínimo`,
    messageCard(message) + detailsTable([
      ['Estoque atual', `${item.stock_qty} ${item.unit}`],
      ['Estoque mínimo', `${item.min_qty} ${item.unit}`],
      ['Diferença', `${item.min_qty - item.stock_qty} ${item.unit}`],
    ]),
    dateBR,
  )
}

function buildWeeklyHtml(items: any[], message: string, period: string, dateBR: string) {
  const low = items.filter((i: any) => i.stock_qty <= i.min_qty)
  const rows = items.map((i: any) => `<tr>
    <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(i.name)}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">${escapeHtml(i.stock_qty)}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">${escapeHtml(i.min_qty)}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;">
      ${i.stock_qty <= i.min_qty
        ? '<span style="color:#dc2626;font-weight:600;">Baixo</span>'
        : '<span style="color:#16a34a;font-weight:600;">OK</span>'}
    </td>
  </tr>`).join('')

  return shellHtml(
    `Contagem Semanal — ${period}`,
    '#0f766e',
    '📦 Contagem Semanal de Consumíveis',
    messageCard(message) +
    `<div style="display:flex;gap:12px;margin-top:16px;flex-wrap:wrap;">
      <div style="flex:1;min-width:160px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Total de itens</div>
        <div style="font-size:28px;font-weight:700;color:#0f766e;margin-top:4px;">${items.length}</div>
      </div>
      <div style="flex:1;min-width:160px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Abaixo do mínimo</div>
        <div style="font-size:28px;font-weight:700;color:#dc2626;margin-top:4px;">${low.length}</div>
      </div>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-top:16px;overflow:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="background:#f8fafc;text-align:left;">
          <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;">Item</th>
          <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;text-align:right;">Estoque</th>
          <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;text-align:right;">Mínimo</th>
          <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;text-align:center;">Status</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="4" style="padding:12px;color:#64748b;font-style:italic;">Sem itens cadastrados.</td></tr>'}</tbody>
      </table>
    </div>`,
    dateBR,
  )
}

async function notifyError(supabase: any, config: any, configId: string, reason: string, dayStr: string, logId: string | null) {
  try {
    const adminList: string[] = (config?.error_notify_recipients?.length ? config.error_notify_recipients : config?.recipients) ?? []
    if (adminList.length === 0) return
    const subject = `[MBR Quality] FALHA — ${config?.name ?? configId}`
    const html = `<!doctype html><body style="font-family:Arial,sans-serif;padding:24px;color:#0f172a;">
      <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #fecaca;border-radius:12px;padding:24px;">
        <div style="background:#dc2626;color:#fff;padding:12px;border-radius:8px;margin-bottom:16px;font-weight:600;">⚠️ Falha na automação de e-mails (Consumíveis)</div>
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
          purpose: 'transactional', label: 'consumiveis-automation-error',
          idempotency_key: `err-cons-${configId}-${dayStr}-${logId ?? 'noLog'}-${to}`,
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
    const { config_id, log_id, test_to, preview, draft, resend, request_id, item_id, subtipo } = body as any
    if (!config_id) {
      return new Response(JSON.stringify({ error: 'config_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    logIdInProgress = log_id ?? null

    const { data: config, error: cfgErr } = await supabase
      .from('email_automation_config').select('*').eq('id', config_id).single()
    if (cfgErr || !config) throw new Error('Configuração não encontrada')
    configCached = config
    const effSubtipo = subtipo ?? config.subtipo ?? 'agendado'

    const { dateBR, dayStr } = todayInTz(config.timezone || 'America/Sao_Paulo')
    dayStrCached = dayStr
    const isReal = !preview && !test_to && !draft && !resend

    let subject = ''
    let html = ''
    let entityId: string | null = null
    let tipo_disparo: string = 'evento'

    // ===== nova_solicitacao =====
    if (effSubtipo === 'nova_solicitacao') {
      let rec: any = null
      if (request_id) {
        const { data } = await supabase.from('consumable_requests').select('*').eq('id', request_id).maybeSingle()
        rec = data
      } else if (test_to || preview) {
        const { data } = await supabase.from('consumable_requests').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle()
        rec = data
      }
      if (!rec) throw new Error('Solicitação não encontrada')
      entityId = test_to ? null : rec.id

      if (isReal && request_id) {
        const { data: existing } = await supabase.from('email_automation_log')
          .select('id').eq('config_id', config.id).eq('entity_id', request_id)
          .in('status', ['queued', 'sent', 'pending']).maybeSingle()
        if (existing) return new Response(JSON.stringify({ ok: true, skipped: 'already_sent_for_entity', existing_log_id: existing.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const vars: Record<string, string> = {
        numero: rec.numero ?? '',
        item_name: rec.item_name ?? '',
        quantity: String(rec.quantity ?? ''),
        user_name: rec.user_name ?? '',
        turno: rec.turno ?? '',
        status: rec.status ?? '',
        date: dateBR,
      }
      subject = replaceVars(config.subject_template || 'Nova solicitação #{{numero}}', vars)
      const messageBody = replaceVars(config.message_body || '', vars)
      html = buildRequestHtml(rec, messageBody, dateBR)
    }
    // ===== estoque_minimo =====
    else if (effSubtipo === 'estoque_minimo') {
      let item: any = null
      if (item_id) {
        const { data } = await supabase.from('consumable_items').select('*').eq('id', item_id).maybeSingle()
        item = data
      } else if (test_to || preview) {
        const { data } = await supabase.from('consumable_items').select('*').order('stock_qty', { ascending: true }).limit(1).maybeSingle()
        item = data
      }
      if (!item) throw new Error('Item não encontrado')
      entityId = test_to ? null : item.id
      tipo_disparo = 'evento'

      if (isReal && item_id) {
        const { data: existing } = await supabase.from('email_automation_log')
          .select('id').eq('config_id', config.id).eq('entity_id', item_id).eq('send_date', dayStr)
          .in('status', ['queued', 'sent', 'pending']).maybeSingle()
        if (existing) return new Response(JSON.stringify({ ok: true, skipped: 'already_sent_for_entity', existing_log_id: existing.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const vars: Record<string, string> = {
        item_name: item.name ?? '',
        stock_qty: String(item.stock_qty ?? ''),
        min_qty: String(item.min_qty ?? ''),
        unit: item.unit ?? '',
        date: dateBR,
      }
      subject = replaceVars(config.subject_template || 'Estoque baixo — {{item_name}}', vars)
      const messageBody = replaceVars(config.message_body || '', vars)
      html = buildLowStockHtml(item, messageBody, dateBR)
    }
    // ===== agendado (contagem_semanal) =====
    else {
      tipo_disparo = 'agendado'
      const { data: items } = await supabase.from('consumable_items').select('*').eq('active', true).order('name')
      const all = items ?? []
      const low = all.filter((i: any) => i.stock_qty <= i.min_qty)
      const period = `Semana até ${dateBR}`

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

      const vars: Record<string, string> = {
        date: dateBR, period,
        total_items: String(all.length),
        total_low: String(low.length),
      }
      subject = replaceVars(config.subject_template || 'Contagem Semanal — {{date}}', vars)
      const messageBody = replaceVars(config.message_body || '', vars)
      html = buildWeeklyHtml(all, messageBody, period, dateBR)
    }

    if (preview) {
      return new Response(JSON.stringify({ ok: true, preview: true, subject, html }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (draft) {
      const { data: ins } = await supabase.from('email_automation_log').insert({
        config_id: config.id, modulo: 'consumiveis', tipo_disparo,
        trigger_type: 'draft', status: 'draft', recipients: config.recipients ?? [],
        subject, preview_html: html, send_date: dayStr, entity_id: entityId,
      }).select('id').single()
      return new Response(JSON.stringify({ ok: true, draft: true, draft_id: ins?.id, subject, html }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const ccList: string[] = Array.isArray((config as any)?.metadata?.cc) ? (config as any).metadata.cc.filter(Boolean) : []
    const recipients: string[] = test_to ? [test_to] : Array.from(new Set([...(config.recipients ?? []), ...ccList].filter(Boolean)))
    if (recipients.length === 0) throw new Error('Sem destinatários configurados')

    for (const to of recipients) {
      await supabase.rpc('enqueue_email', {
        queue_name: 'transactional_emails',
        payload: {
          to, from: FROM_ADDR, sender_domain: SENDER_DOMAIN, subject, html,
          purpose: 'transactional', label: `consumiveis-${effSubtipo}`,
          idempotency_key: `cons-${config.id}-${entityId ?? dayStr}-${to}${test_to ? `-test-${Date.now()}` : ''}${resend ? `-r${Date.now()}` : ''}`,
          message_id: crypto.randomUUID(), queued_at: new Date().toISOString(),
        },
      })
    }

    const trigger_type = test_to ? 'test' : (resend ? 'manual' : (tipo_disparo === 'agendado' ? 'scheduled' : 'evento'))
    if (log_id) {
      await supabase.from('email_automation_log').update({
        status: 'queued', recipients, subject, send_date: dayStr,
      }).eq('id', log_id)
    } else {
      await supabase.from('email_automation_log').insert({
        config_id: config.id, modulo: 'consumiveis', tipo_disparo,
        trigger_type, status: 'queued', recipients, subject,
        send_date: dayStr, entity_id: entityId,
      })
    }
    if (!test_to && !resend) {
      await supabase.from('email_automation_config').update({ last_sent_at: new Date().toISOString() }).eq('id', config.id)
    }
    return new Response(JSON.stringify({ ok: true, queued: recipients.length, subject }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('send-consumiveis-email error', msg)
    try {
      if (logIdInProgress) {
        await supabase.from('email_automation_log').update({
          status: 'failed', error_message: msg.slice(0, 1000),
        }).eq('id', logIdInProgress)
      } else if (body?.config_id && !body?.preview && !body?.draft) {
        await supabase.from('email_automation_log').insert({
          config_id: body.config_id, modulo: 'consumiveis',
          tipo_disparo: body?.item_id || body?.request_id ? 'evento' : 'agendado',
          trigger_type: body?.test_to ? 'test' : 'manual',
          recipients: body?.test_to ? [body.test_to] : [],
          status: 'failed', error_message: msg.slice(0, 1000),
          send_date: dayStrCached || null, entity_id: body?.item_id ?? body?.request_id ?? null,
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
