// Validate the workflow files parse, and that every step has a run or uses.
//
// Two commits ago the CI job failed with "This run likely failed because of a
// workflow file issue" - and nothing local caught it, because every local command
// passed. The cause was an edit that matched an existing step's text and replaced
// it from column 0, silently de-indenting it out of the `steps:` list. GitHub then
// rejected the whole file, so the job never ran and the run reported failure with
// no failing check anywhere.
//
// A workflow file that does not parse means no CI at all, which is worse than a
// red test: it is invisible until it ships. So it is checked here, and the check
// is in the test suite that runs before it.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, '.github', 'workflows')

let yaml
try {
  yaml = (await import('yaml')).default
} catch {
  console.log('audit-workflow: the yaml package is not installed, skipping')
  process.exit(0)
}

const files = fs.readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f))
if (!files.length) {
  console.log('audit-workflow: no workflow files found')
  process.exit(0)
}

let failed = 0
for (const file of files) {
  const p = path.join(DIR, file)
  const src = fs.readFileSync(p, 'utf8')
  let doc
  try {
    doc = yaml.parse(src)
  } catch (e) {
    failed++
    console.log(`FAIL ${file}: does not parse - ${e.message.split('\n')[0]}`)
    continue
  }
  if (!doc || !doc.jobs) {
    failed++
    console.log(`FAIL ${file}: parses but has no jobs`)
    continue
  }
  const jobNames = Object.keys(doc.jobs)
  if (!jobNames.length) {
    failed++
    console.log(`FAIL ${file}: has zero jobs, so nothing would ever run`)
    continue
  }
  let steps = 0
  const problems = []
  for (const [name, job] of Object.entries(doc.jobs)) {
    const list = Array.isArray(job?.steps) ? job.steps : []
    if (!list.length) {
      problems.push(`job "${name}" has no steps`)
      continue
    }
    steps += list.length
    for (const [i, s] of list.entries()) {
      if (!s || (s.run === undefined && s.uses === undefined)) {
        problems.push(`job "${name}" step ${i + 1} has neither run nor uses`)
      }
    }
  }
  if (problems.length) {
    failed++
    console.log(`FAIL ${file}:`)
    for (const p2 of problems) console.log(`     ${p2}`)
  } else {
    console.log(`ok   ${file}: ${jobNames.length} jobs, ${steps} steps`)
  }
}

if (failed) {
  console.log(`\n${failed} workflow file(s) invalid - CI would not run`)
  process.exit(1)
}
console.log('all workflow files valid')