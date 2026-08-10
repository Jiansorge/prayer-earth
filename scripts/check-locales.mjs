import { readFileSync } from 'node:fs'

function keys(p) {
  const body = readFileSync(p, 'utf8').match(/export default \{([\s\S]*)\}/)[1]
  const ks = new Set()
  const re = /'([^']+)':/g
  let x
  while ((x = re.exec(body))) ks.add(x[1])
  return ks
}

const en = keys('src/locales/en.js')
for (const f of ['ar', 'bo', 'de', 'es', 'fr', 'hi', 'it', 'ja', 'ko', 'pt', 'ru', 'vi', 'zh']) {
  const k = keys(`src/locales/${f}.js`)
  const miss = [...en].filter((x) => !k.has(x))
  const nonLegal = miss.filter((x) => !x.startsWith('legal.'))
  console.log(`${f}: missing total=${miss.length}, non-legal=${nonLegal.join(', ')}`)
}