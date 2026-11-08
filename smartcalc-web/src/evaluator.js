const F = { sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  ln: Math.log, log: Math.log10, sqrt: Math.sqrt, abs: Math.abs }
const clean = (v) => Number(v.toPrecision(12))

export function evaluate(input, deg = true) {
  let s = input.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, 'p').replace(/√/g, 'sqrt')
  const open = (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length
  if (open > 0) s += ')'.repeat(open)
  const toks = s.match(/\d+\.?\d*|\.\d+|[a-z]+|[-+*/^()!%]/g) || []
  if (toks.join('') !== s.replace(/\s/g, '')) throw new Error('Invalid expression')
  let i = 0
  const peek = () => toks[i], next = () => toks[i++]
  const isStart = (t) => t && (/^[\d.]/.test(t) || /^[a-z]/.test(t) || t === '(')
  const toRad = (x) => (deg ? (x * Math.PI) / 180 : x)
  const fromRad = (x) => (deg ? (x * 180) / Math.PI : x)

  function expr() {
    let v = term()
    while (peek() === '+' || peek() === '-') v = next() === '+' ? v + term() : v - term()
    return v
  }
  function term() {
    let v = unary()
    for (;;) {
      const t = peek()
      if (t === '*') { next(); v *= unary() }
      else if (t === '/') { next(); const d = unary(); if (d === 0) throw new Error("Can't divide by zero"); v /= d }
      else if (isStart(t)) v *= unary()
      else return v
    }
  }
  function unary() {
    if (peek() === '-') { next(); return -unary() }
    if (peek() === '+') { next(); return unary() }
    return power()
  }
  function power() {
    const b = post()
    if (peek() === '^') { next(); return Math.pow(b, unary()) }
    return b
  }
  function post() {
    let v = primary()
    for (;;) {
      if (peek() === '!') {
        next()
        if (v < 0 || !Number.isInteger(v) || v > 170) throw new Error('Factorial needs 0–170')
        let f = 1; for (let k = 2; k <= v; k++) f *= k; v = f
      } else if (peek() === '%') { next(); v /= 100 }
      else return v
    }
  }
  function primary() {
    const t = next()
    if (t === undefined) throw new Error('Incomplete expression')
    if (/^[\d.]/.test(t)) return parseFloat(t)
    if (t === '(') { const v = expr(); if (next() !== ')') throw new Error('Missing )'); return v }
    if (t === 'p') return Math.PI
    if (t === 'e') return Math.E
    if (F[t]) {
      if (next() !== '(') throw new Error('Invalid expression')
      const a = expr(); if (next() !== ')') throw new Error('Missing )')
      if (t === 'sin' || t === 'cos' || t === 'tan') return clean(F[t](toRad(a)))
      if (t === 'asin' || t === 'acos' || t === 'atan') {
        if ((t !== 'atan') && Math.abs(a) > 1) throw new Error('Out of range')
        return clean(fromRad(F[t](a)))
      }
      if ((t === 'ln' || t === 'log') && a <= 0) throw new Error('Must be positive')
      if (t === 'sqrt' && a < 0) throw new Error('No real square root')
      return F[t](a)
    }
    throw new Error('Invalid expression')
  }
  const out = expr()
  if (i < toks.length) throw new Error('Invalid expression')
  if (!Number.isFinite(out)) throw new Error('Result too large')
  return clean(out)
}

export function fmt(v, prec = 4, sep = true) {
  if (Math.abs(v) >= 1e15 || (v !== 0 && Math.abs(v) < 1e-9)) return v.toExponential(Math.min(prec, 6)).replace(/\.?0+e/, 'e')
  let s = v.toFixed(prec)
  if (s.includes('.')) s = s.replace(/\.?0+$/, '')
  if (s === '-0') s = '0'
  if (!sep) return s
  const [a, b] = s.split('.')
  return a.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (b ? '.' + b : '')
}
