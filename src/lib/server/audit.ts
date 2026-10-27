import "server-only";
import { query } from "./db";

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string | null;
  details: Record<string, unknown> | null;
  created_at: Date;
}

/** Record a security-relevant action. Never throws: a failed log write must not undo the action. */
export async function audit(actor: string, action: string, target: string | null, details?: Record<string, unknown>) {
  try {
    await query(`INSERT INTO audit_log (actor, action, target, details) VALUES ($1, $2, $3, $4)`, [
      actor,
      action,
      target,
      details ? JSON.stringify(details) : null,
    ]);
  } catch (err) {
    console.error("audit log write failed", { actor, action, target, err });
  }
}

export const recentAudit = (limit = 100) =>
  query<AuditEntry>(`SELECT id, actor, action, target, details, created_at FROM audit_log ORDER BY created_at DESC LIMIT $1`, [limit]);
