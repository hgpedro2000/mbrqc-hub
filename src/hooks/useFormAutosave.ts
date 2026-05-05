import { useEffect, useRef } from "react";

/**
 * Autosave de snapshot do formulário em sessionStorage.
 *
 * Por que existe: em Android, quando o usuário tira foto pela câmera, o SO
 * pode matar o WebView (memória baixa) enquanto o app de câmera está aberto.
 * Ao voltar, o React re-monta e perde todo o state. Esse hook salva o
 * snapshot debounced e permite restaurar na montagem.
 *
 * Não persiste arquivos (File/Blob) — só dados serializáveis.
 *
 * Uso:
 *   useFormAutosave("apontamento:novo:incoming", {
 *     data, turno, projeto, ...
 *   }, isEdit ? null : enabled);
 *
 *   // Na inicialização: const restored = readFormAutosave(key);
 */

const PREFIX = "form-autosave:";

export function readFormAutosave<T = any>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearFormAutosave(key: string) {
  try {
    sessionStorage.removeItem(PREFIX + key);
  } catch { /* ignore */ }
}

export function useFormAutosave<T extends Record<string, any>>(
  key: string,
  snapshot: T,
  enabled = true
) {
  const timer = useRef<number | null>(null);
  const fullKey = PREFIX + key;

  useEffect(() => {
    if (!enabled) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      try {
        sessionStorage.setItem(fullKey, JSON.stringify({
          __ts: Date.now(),
          data: snapshot,
        }));
      } catch { /* quota exceeded etc. */ }
    }, 400);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [enabled, fullKey, snapshot]);
}
