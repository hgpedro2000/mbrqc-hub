// Helpers to share data via WhatsApp using the universal web link.
// wa.me without number opens the contact picker so the admin chooses who to send to.

export function openWhatsApp(message: string) {
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

interface ResetMessageInput {
  userName?: string | null;
  employeeNumber?: string | null;
  password: string;
  appUrl?: string;
}

export function buildResetPasswordMessage({
  userName,
  employeeNumber,
  password,
  appUrl,
}: ResetMessageInput) {
  const greeting = userName ? `Olá, ${userName}!` : "Olá!";
  const lines = [
    greeting,
    "",
    "Sua senha foi redefinida no MBR Quality.",
    employeeNumber ? `• Matrícula: ${employeeNumber}` : null,
    `• Senha provisória: ${password}`,
    "",
    "Por segurança, você precisará trocar a senha no próximo acesso.",
    appUrl ? `Acesse: ${appUrl}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}
