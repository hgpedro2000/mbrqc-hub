import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FALLBACK = '—'
const APP_URL = Deno.env.get('APP_PUBLIC_URL') ?? 'https://mbrquality.lovable.app'
const SENDER_DOMAIN = Deno.env.get('SENDER_DOMAIN') ?? 'notify.mbrqc.com.br'
const FROM_ADDR = 'informacao@mbrqc.com.br'

const SUBTIPO_META: Record<string, { label: string; color: string; icon: string }> = {
  iniciada:      { label: 'Iniciada',     color: '#2563eb', icon: '🟦' },
  em_andamento:  { label: 'Em Andamento', color: '#d97706', icon: '⚙️' },
  concluida:     { label: 'Concluída',    color: '#16a34a', icon: '✅' },
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
  return { dateBR: d.toLocaleDateString('pt-BR'), dayStr: `${y}-${m}-${day}` }
}

function buildHtml(contencao: any, subtipo: string, message: string, link: string) {
  const meta = SUBTIPO_META[subtipo] ?? SUBTIPO_META.iniciada
  return `<!doctype html><html><head><meta charset="utf-8"><title>Contenção #${escapeHtml(contencao.numero)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'DM Sans',Arial,sans-serif;color:#0f172a;">
  <div style="max-width:720px;margin:0 auto;padding:24px;">
    <div style="background:${meta.color};color:#fff;border-radius:12px;padding:20px;">
      <div style="font-size:12px;opacity:.85;text-transform:uppercase;letter-spacing:.1em;">MBR Quality • Contenção</div>
      <h1 style="margin:8px 0 4px;font-size:22px;font-weight:700;">${meta.icon} Contenção #${escapeHtml(contencao.numero)} — ${escapeHtml(meta.label)}</h1>
      <div style="font-size:13px;opacity:.9;">${escapeHtml(contencao.titulo)}</div>
    </div>

    ${message ? `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-top:16px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</div>` : ''}

    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-top:16px;">
      <h2 style="margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Detalhes</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        ${[
          ['Tipo', contencao.tipo],
          ['Status', contencao.status],
          ['Responsável', contencao.responsavel],
          ['Data', fmtDate(contencao.data)],
          ['Setor', contencao.setor],
          ['Linha', contencao.linha],
          ['Part Number', contencao.part_number],
          ['Part Name', contencao.part_name],
          ['Fornecedor', contencao.fornecedor],
          ['Qtd contida', contencao.quantidade_contida],
          ['Qtd aprovada', contencao.quantidade_aprovada],
          ['Qtd rejeitada', contencao.quantidade_rejeitada],
        ].map(([k, v]) => `<tr>
          <td style="padding:6px 0;color:#64748b;width:160px;">${k}</td>
          <td style="padding:6px 0;font-weight:500;">${escapeHtml(v)}</td>
        </tr>`).join('')}
      </table>
      ${contencao.motivo ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0;">
        <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Motivo</div>
        <div style="margin-top:6px;font-size:13px;white-space:pre-wrap;">${escapeHtml(contencao.motivo)}</div>
      </div>` : ''}
      ${contencao.acao_contencao ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0;">
        <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Ação de contenção</div>
        <div style="margin-top:6px;font-size:13px;white-space:pre-wrap;">${escapeHtml(contencao.acao_contencao)}</div>
      </div>` : ''}
      ${contencao.observacoes ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0;">
        <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Observações</div>
        <div style="margin-top:6px;font-size:13px;white-space:pre-wrap;">${escapeHtml(contencao.observacoes)}</div>
      </div>` : ''}
    </div>

    <div style="background:#354052;color:#fff;border-radius:12px;padding:16px;margin-top:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
      <div>
        <div style="font-size:11px;opacity:.7;text-transform:uppercase;letter-spacing:.1em;">Acessar no sistema</div>
        <div style="font-size:14px;font-weight:600;">Abrir esta Contenção</div>
      </div>
      <a href="${link}" style="background:#fff;color:#354052;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;">Abrir</a>
    </div>

    <p style="text-align:center;font-size:11px;color:#94a3b8;margin:24px 0 0;">MBR Quality — Envio automatizado</p>
  </div>
</body></html>`
}

async function notifyError(supabase: any, config: any, configId: string, reason: string, dayStr: string, logId: string | null) {
  try {
    const adminList: string[] = (config?.error_notify_recipients?.length ? config.error_notify_recipients : config?.recipients) ?? []
    if (adminList.length === 0) return
    const subject = `[MBR Quality] FALHA — ${config?.name ?? configId}`
    const html = `<!doctype html><body style="font-family:Arial,sans-serif;padding:24px;color:#0f172a;">
      <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #fecaca;border-radius:12px;padding:24px;">
        <div style="background:#dc2626;color:#fff;padding:12px;border-radius:8px;margin-bottom:16px;font-weight:600;">⚠️ Falha na automação de e-mails (Contenção)</div>
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
          purpose: 'transactional', label: 'contencao-automation-error',
          idempotency_key: `err-contencao-${configId}-${dayStr}-${logId ?? 'noLog'}-${to}`,
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
    const { config_id, log_id, test_to, preview, draft, resend, contencao_id, subtipo } = body as {
      config_id?: string; log_id?: string; test_to?: string;
      preview?: boolean; draft?: boolean; resend?: boolean;
      contencao_id?: string; subtipo?: string;
    }
    if (!config_id) {
      return new Response(JSON.stringify({ error: 'config_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    logIdInProgress = log_id ?? null

    const { data: config, error: cfgErr } = await supabase
      .from('email_automation_config').select('*').eq('id', config_id).single()
    if (cfgErr || !config) throw new Error('Configuração não encontrada')
    configCached = config
    const effSubtipo = subtipo ?? config.subtipo ?? 'iniciada'

    const { dateBR, dayStr } = todayInTz(config.timezone || 'America/Sao_Paulo')
    dayStrCached = dayStr

    // Load contencao record
    let contencao: any = null
    if (contencao_id) {
      const { data } = await supabase.from('contencao').select('*').eq('id', contencao_id).maybeSingle()
      contencao = data
    } else if (test_to || preview) {
      const { data } = await supabase.from('contencao').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle()
      contencao = data
    }
    if (!contencao) throw new Error('Contenção não encontrada (informe contencao_id ou crie um registro para testar)')

    const isReal = !preview && !test_to && !draft && !resend

    // Idempotency by (config_id, entity_id)
    if (isReal && contencao_id) {
      const { data: existing } = await supabase.from('email_automation_log')
        .select('id, status').eq('config_id', config.id).eq('entity_id', contencao_id)
        .in('status', ['queued', 'sent', 'pending']).maybeSingle()
      if (existing) {
        return new Response(JSON.stringify({ ok: true, skipped: 'already_sent_for_entity', existing_log_id: existing.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    const link = `${APP_URL}/contencao`
    const meta = SUBTIPO_META[effSubtipo] ?? SUBTIPO_META.iniciada
    const vars: Record<string, string> = {
      numero: contencao.numero ?? '',
      titulo: contencao.titulo ?? '',
      tipo: contencao.tipo ?? '',
      status: contencao.status ?? '',
      responsavel: contencao.responsavel ?? '',
      setor: contencao.setor ?? '',
      linha: contencao.linha ?? '',
      part_number: contencao.part_number ?? '',
      part_name: contencao.part_name ?? '',
      fornecedor: contencao.fornecedor ?? '',
      motivo: contencao.motivo ?? '',
      acao_contencao: contencao.acao_contencao ?? '',
      observacoes: contencao.observacoes ?? '',
      quantidade_contida: String(contencao.quantidade_contida ?? ''),
      quantidade_aprovada: String(contencao.quantidade_aprovada ?? ''),
      quantidade_rejeitada: String(contencao.quantidade_rejeitada ?? ''),
      data: fmtDate(contencao.data),
      date: dateBR,
      evento: meta.label,
      link,
    }
    const subject = replaceVars(config.subject_template || `Contenção #{{numero}} — ${meta.label}`, vars)
    const messageBody = replaceVars(config.message_body || '', vars)
    const html = buildHtml(contencao, effSubtipo, messageBody, link)

    if (preview) {
      return new Response(JSON.stringify({ ok: true, preview: true, subject, html, contencao_id: contencao.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (draft) {
      const { data: ins } = await supabase.from('email_automation_log').insert({
        config_id: config.id, modulo: 'contencao', tipo_disparo: 'evento',
        trigger_type: 'draft', status: 'draft', recipients: config.recipients ?? [],
        subject, preview_html: html, send_date: dayStr, entity_id: contencao.id,
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
          purpose: 'transactional', label: `contencao-${effSubtipo}`,
          idempotency_key: `contencao-${config.id}-${contencao.id}-${to}${test_to ? `-test-${Date.now()}` : ''}${resend ? `-r${Date.now()}` : ''}`,
          message_id: crypto.randomUUID(), queued_at: new Date().toISOString(),
        },
      })
    }

    const trigger_type = test_to ? 'test' : (resend ? 'manual' : 'evento')
    if (log_id) {
      await supabase.from('email_automation_log').update({
        status: 'queued', recipients, subject, send_date: dayStr,
      }).eq('id', log_id)
    } else {
      await supabase.from('email_automation_log').insert({
        config_id: config.id, modulo: 'contencao', tipo_disparo: 'evento',
        trigger_type, status: 'queued', recipients, subject,
        send_date: dayStr, entity_id: test_to ? null : contencao.id,
      })
    }
    if (!test_to && !resend) {
      await supabase.from('email_automation_config').update({ last_sent_at: new Date().toISOString() }).eq('id', config.id)
    }
    return new Response(JSON.stringify({ ok: true, queued: recipients.length, subject }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('send-contencao-email error', msg)
    try {
      if (logIdInProgress) {
        await supabase.from('email_automation_log').update({
          status: 'failed', error_message: msg.slice(0, 1000),
        }).eq('id', logIdInProgress)
      } else if (body?.config_id && !body?.preview && !body?.draft) {
        await supabase.from('email_automation_log').insert({
          config_id: body.config_id, modulo: 'contencao', tipo_disparo: 'evento',
          trigger_type: body?.test_to ? 'test' : 'manual',
          recipients: body?.test_to ? [body.test_to] : [],
          status: 'failed', error_message: msg.slice(0, 1000),
          send_date: dayStrCached || null, entity_id: body?.contencao_id ?? null,
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
