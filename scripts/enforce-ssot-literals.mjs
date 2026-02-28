import fs from 'node:fs'
import path from 'node:path'

const PROJECT_ROOT = process.cwd()
const SRC_ROOT = path.join(PROJECT_ROOT, 'src')

const EXCLUDED_FILES = new Set([
  path.join(SRC_ROOT, 'config', 'constants.ts'),
  path.join(SRC_ROOT, 'config', 'routes.ts'),
  path.join(SRC_ROOT, 'config', 'prompts.ts'),
  path.join(SRC_ROOT, 'config', 'models.ts'),
  path.join(SRC_ROOT, 'lib', 'utils', 'errors.ts'),
])

const EXCLUDED_DIRECTORIES = [path.join(SRC_ROOT, 'schemas')]

const BANNED_LITERALS = [
  'model_selected',
  'tool_start',
  'tool_result',
  'a2ui',
  'routing',
  'searching',
  'reading_files',
  'generating_ui',
  'generating_title',
  '/chat',
  '/login',
  '/api/trpc',
  '/api/auth',
  '/api/health',
  'Search conversations',
  'New chat',
  '```a2ui',
  'Attachment not found or access denied.',
  'Missing conversation id for title generation.',
]

const QUOTE_PATTERNS = ["'", '"', '`']

function isExcluded(filePath) {
  if (EXCLUDED_FILES.has(filePath)) return true
  return EXCLUDED_DIRECTORIES.some((dirPath) => filePath.startsWith(dirPath))
}

function collectFiles(dirPath, out = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      collectFiles(fullPath, out)
      continue
    }
    if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      out.push(fullPath)
    }
  }
  return out
}

function lineHasLiteral(line, literal) {
  return QUOTE_PATTERNS.some((quote) => line.includes(`${quote}${literal}${quote}`))
}

const violations = []
const files = collectFiles(SRC_ROOT).filter((filePath) => !isExcluded(filePath))

for (const filePath of files) {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (!line) continue
    const matchedLiteral = BANNED_LITERALS.find((literal) => lineHasLiteral(line, literal))
    if (!matchedLiteral) continue
    violations.push({
      file: path.relative(PROJECT_ROOT, filePath),
      line: i + 1,
      literal: matchedLiteral,
      code: line.trim(),
    })
  }
}

if (violations.length > 0) {
  console.error('SSOT literal violations found. Use constants from src/config/*.ts')
  for (const violation of violations) {
    console.error(`${violation.file}:${violation.line} -> ${violation.literal} | ${violation.code}`)
  }
  process.exit(1)
}

console.log('SSOT literal check passed.')
