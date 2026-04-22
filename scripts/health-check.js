 Conteúdo:
  // Health check script - verifica conectividade com Supabase
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("ERRO: Variáveis de ambiente não
  configuradas.");
    process.exit(1);
  }

  async function healthCheck() {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      });
      if (response.ok || response.status === 404) {
        console.log("✅ Supabase acessível. Status:",
  response.status);
        process.exit(0);
      } else {
        console.error("❌ Supabase retornou status:",
  response.status);
        process.exit(1);
      }
    } catch (err) {
      console.error("❌ Falha de conectividade:", err.message);
      process.exit(1);
    }
  }

  healthCheck();
