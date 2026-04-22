-- Allow public (anonymous) read of privacy_policy key only
CREATE POLICY "Anyone can read privacy_policy"
ON public.app_config
FOR SELECT
TO anon, authenticated
USING (key = 'privacy_policy');

-- Insert default privacy policy content if not exists
INSERT INTO public.app_config (key, value)
VALUES (
  'privacy_policy',
  E'# Política de Privacidade\n\n**Última atualização:** Abril de 2026\n\n## 1. Dados Coletados\n\nO Quality Tools MBR coleta apenas os seguintes dados pessoais dos colaboradores:\n\n- **Nome completo**\n- **Número de matrícula** (employee number)\n- **Turno de trabalho**\n- **Empresa** (Mobis Brasil ou empresa terceira)\n- **Cargo / função**\n- **E-mail corporativo** (quando aplicável)\n\n## 2. Finalidade do Tratamento\n\nOs dados coletados são utilizados exclusivamente para:\n\n- Controle de qualidade industrial\n- Rastreabilidade de inspeções, apontamentos e auditorias\n- Gestão de qualificações e treinamentos\n- Auditoria interna de ações operacionais\n- Comunicação de alertas de qualidade entre setores\n\n## 3. Base Legal (LGPD)\n\nO tratamento dos dados é realizado com base no **legítimo interesse** do controlador, conforme previsto no Art. 7º, IX, da Lei Geral de Proteção de Dados (Lei nº 13.709/2018), para o desempenho regular das atividades de controle de qualidade da Hyundai Mobis Brasil.\n\n## 4. O Que NÃO É Coletado\n\nO Quality Tools MBR **não coleta**, em hipótese alguma:\n\n- Dados sensíveis (origem racial, opinião política, religião, etc.)\n- Dados financeiros (salários, contas bancárias, cartões)\n- Dados de saúde\n- Dados biométricos\n- Localização geográfica\n- Histórico de navegação fora do sistema\n\n## 5. Compartilhamento\n\nOs dados são acessíveis apenas a colaboradores autorizados da Área de Qualidade da Hyundai Mobis Brasil e não são compartilhados com terceiros externos.\n\n## 6. Retenção\n\nOs dados são mantidos enquanto o colaborador estiver vinculado às operações da Hyundai Mobis Brasil ou conforme exigência legal aplicável.\n\n## 7. Direitos do Titular\n\nO titular dos dados pode, a qualquer momento:\n\n- Solicitar acesso aos seus dados\n- Solicitar correção de dados incorretos\n- Solicitar exclusão de dados desnecessários\n- Revogar consentimento\n\n## 8. Responsável pelo Tratamento\n\n**Área de Qualidade — Hyundai Mobis Brasil**\n\n**Contato:** qualidade@mobis.com.br\n\n## 9. Segurança\n\nO sistema utiliza autenticação multifator (MFA), criptografia em trânsito (HTTPS), políticas de senha robustas e logs de auditoria para garantir a segurança dos dados.'
)
ON CONFLICT (key) DO NOTHING;