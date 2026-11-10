const productionProjectRef = 'hthpdsxnbykkqgiyciwj'
const rawUrl = process.env.TRAINOS_TEST_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL

if (!rawUrl) {
  console.error('Refusing to run Supabase integration tests: set TRAINOS_TEST_SUPABASE_URL to a local test stack URL.')
  process.exit(1)
}

let target
try {
  target = new URL(rawUrl)
} catch {
  console.error('Refusing to run Supabase integration tests: the configured test URL is invalid.')
  process.exit(1)
}

const isLoopback = target.hostname === '127.0.0.1' || target.hostname === 'localhost' || target.hostname === '::1'
const isProduction = target.hostname.includes(productionProjectRef)

if (!isLoopback || isProduction) {
  console.error(`Refusing to run Supabase integration tests against non-local target: ${target.origin}`)
  process.exit(1)
}

console.log(`Safe test target verified: ${target.origin}`)
