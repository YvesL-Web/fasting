import { z, ZodError } from 'zod'

// Arbre attendu: { _errors: string[]; [key: string]: ZodTree | string[] }
export type ZodTree = { _errors: string[]; [key: string]: ZodTree | string[] }

// Type minimal pour ne pas dépendre de types dépréciés
type MinimalIssue = { path: Array<string | number>; message: string }

function polyfillTreeify(issues: MinimalIssue[]): ZodTree {
  const root: ZodTree = { _errors: [] }
  for (const issue of issues) {
    let node: ZodTree = root
    const segments = issue.path.map(String) // normalise en string
    for (const seg of segments) {
      if (!(seg in node)) node[seg] = { _errors: [] }
      node = node[seg] as ZodTree
    }
    node._errors.push(issue.message)
  }
  return root
}

/**
 * Transforme une ZodError en structure arborescente stable.
 * - Utilise z.treeifyError si disponible (API recommandée),
 * - Sinon fallback polyfill (même forme: {_errors, field, ...}).
 */
export function treeifyErrorSafe(err: ZodError): ZodTree {
  const anyZ = z as unknown as { treeifyError?: (e: ZodError) => ZodTree }
  if (typeof anyZ.treeifyError === 'function') {
    return anyZ.treeifyError(err)
  }
  const minimal: MinimalIssue[] = err.issues.map((i) => ({
    path: i.path as MinimalIssue['path'],
    message: i.message
  }))
  return polyfillTreeify(minimal)
}
