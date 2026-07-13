import type { CSSProperties, ReactNode } from "react";
import { useAuditPhotoUrl } from "@/lib/auditPhoto";

export function SignedAuditImg({
  path,
  alt = "",
  style,
  className,
  fallback,
}: {
  path?: string | null;
  alt?: string;
  style?: CSSProperties;
  className?: string;
  fallback?: ReactNode;
}) {
  const url = useAuditPhotoUrl(path);
  if (!url) return <>{fallback ?? null}</>;
  return <img src={url} alt={alt} style={style} className={className} />;
}

export function SignedAuditLink({
  path,
  children,
  className,
  style,
}: {
  path?: string | null;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const url = useAuditPhotoUrl(path);
  if (!url) return <>{children}</>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className={className} style={style}>
      {children}
    </a>
  );
}
