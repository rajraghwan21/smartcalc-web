import { useState, useEffect, useMemo, useRef } from 'react'
import { evaluate, fmt } from './evaluator.js'

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
function useStore(k, d) {
  const [v, setV] = useState(() => load(k, d))
  useEffect(() => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }, [k, v])
  return [v, setV]
}
const FN = /(sin|cos|tan|asin|acos|atan|ln|log|sqrt|abs)\($/

export default function App() {
  const [tab, setTab] = useState('calc')
  const [st, setSt] = useStore('sc.settings', { theme: 'dark', prec: 4, deg: true, sep: true })
  const [hist, setHist] = useStore('sc.history', [])
  const [sci, setSci] = useState(false)
  const [inv, setInv] = useState(false)
  const [expr, setExpr] = useState('')
  const [done, setDone] = useState(false)
  const [mem, setMem] = useState(0)
  const [err, setErr] = useState('')

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => { document.documentElement.dataset.theme = st.theme === 'system' ? (mq.matches ? 'dark' : 'light') : st.theme }
    apply(); mq.addEventListener('change', apply); return () => mq.removeEventListener('change', apply)
  }, [st.theme])

  const val = () => { try { return expr ? evaluate(expr, st.deg) : 0 } catch { return 0 } }
  const preview = useMemo(() => {
    if (!expr || /^-?[\d.]+$/.test(expr)) return ''
    try { return fmt(evaluate(expr, st.deg), st.prec, st.sep) } catch { return '' }
  }, [expr, st.deg, st.prec, st.sep])

  const ins = (t, kind) => {
    setErr('')
    let base = expr
    if (done && kind === 'v') base = ''
    setDone(false)
    if (kind === 'o') {
      if (!base) return setExpr(t === '−' ? t : '0' + t)
      if (/[+−×÷^]$/.test(base)) return setExpr(base.slice(0, -1) + t)
    }
    setExpr(base + t)
  }
  const press = (k) => {
    if (k === 'AC') { setExpr(''); setDone(false); setErr(''); return }
    if (k === 'DEL') { setErr(''); setDone(false); setExpr(done ? '' : expr.replace(FN, '').length < expr.length ? expr.replace(FN, '') : expr.slice(0, -1)); return }
    if (k === '=') {
      if (!expr) return
      try {
        const v = evaluate(expr, st.deg)
        setHist((h) => [{ id: Date.now(), e: expr, r: fmt(v, st.prec, st.sep), raw: fmt(v, st.prec, false), fav: false }, ...h].slice(0, 200))
        setExpr(fmt(v, st.prec, false)); setDone(true); setErr('')
      } catch (x) { setErr(x.message) }
      return
    }
    if (k === 'MC') return setMem(0)
    if (k === 'MR') return ins(fmt(mem, 8, false), 'v')
    if (k === 'M+') return setMem(mem + val())
    if (k === 'M−') return setMem(mem - val())
    if (k === '( )') {
      const o = (expr.match(/\(/g) || []).length - (expr.match(/\)/g) || []).length
      return ins(o > 0 && /[\d.)πe!%]$/.test(expr) ? ')' : '(', 'v')
    }
    if (k === '1/') return ins('1÷', 'v')
    if (/^(sin|cos|tan|asin|acos|atan|ln|log|√|abs)$/.test(k)) return ins(k + '(', 'v')
    if (/^[+−×÷^]$/.test(k)) return ins(k, 'o')
    if (k === '%' || k === '!') return ins(k, 'p')
    ins(k, 'v')
  }
  const latest = useRef(); latest.current = press
  useEffect(() => {
    const map = { '*': '×', '/': '÷', '-': '−', Enter: '=', '=': '=', Backspace: 'DEL', Escape: 'AC', '(': '(', ')': ')' }
    const onKey = (e) => {
      if (tab !== 'calc' || e.ctrlKey || e.metaKey || e.target.tagName === 'INPUT') return
      const k = map[e.key] ?? (/^[\d.+^%!]$/.test(e.key) ? e.key : null)
      if (k) { e.preventDefault(); latest.current(k) }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [tab])

  const K = ({ k, label, c = 'num', ...p }) => <button className={'key ' + c} onClick={() => press(k)} {...p}>{label ?? k}</button>
  const shown = expr ? (st.sep && done ? fmt(parseFloat(expr) || 0, st.prec, true) : expr) : '0'

  return (
    <div className="app">
      <header>
        <h1>⚡ SmartCalc</h1>
        <nav>{['calc', 'history', 'settings'].map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t === 'calc' ? 'Calculator' : t[0].toUpperCase() + t.slice(1)}</button>)}</nav>
      </header>

      {tab === 'calc' && (<>
        <div className="bar">
          <button className="chip" onClick={() => setSci(!sci)}>{sci ? 'Scientific' : 'Standard'}</button>
          <button className="chip" onClick={() => setSt({ ...st, deg: !st.deg })}>{st.deg ? 'DEG' : 'RAD'}</button>
          {mem !== 0 && <span className="chip amber">M {fmt(mem, 4, true)}</span>}
        </div>
        <section className="display" aria-live="polite">
          <div className={'expr' + (shown.length > 14 ? ' long' : '')}>{shown}</div>
          <div className={'prev' + (err ? ' err' : '')}>{err || (preview ? '= ' + preview : '\u00a0')}</div>
        </section>
        <div className="grid mem">{['MC', 'MR', 'M+', 'M−'].map((k) => <K key={k} k={k} c="mem" />)}</div>
        {sci && (
          <div className="grid sci">
            <button className={'key mem' + (inv ? ' act' : '')} onClick={() => setInv(!inv)}>INV</button>
            {['sin', 'cos', 'tan'].map((f) => <K key={f} k={inv ? 'a' + f : f} c="fn" />)}
            <K k="π" c="fn" />
            <K k="ln" c="fn" /><K k="log" c="fn" /><K k="√" c="fn" /><K k="^" label="x^y" c="fn" /><K k="e" c="fn" />
            <K k="(" c="fn" /><K k=")" c="fn" /><K k="!" label="n!" c="fn" /><K k="abs" label="|x|" c="fn" /><K k="1/" label="1/x" c="fn" />
          </div>
        )}
        <div className="grid main">
          <K k="AC" c="clear" /><K k="( )" c="op" /><K k="%" c="op" /><K k="÷" c="op" />
          <K k="7" /><K k="8" /><K k="9" /><K k="×" c="op" />
          <K k="4" /><K k="5" /><K k="6" /><K k="−" c="op" />
          <K k="1" /><K k="2" /><K k="3" /><K k="+" c="op" />
          <K k="0" /><K k="." /><K k="DEL" label="⌫" c="op" aria-label="Backspace" /><K k="=" c="eq" />
        </div>
      </>)}

      {tab === 'history' && (
        <section className="panel">
          <div className="row"><h2>History</h2>{hist.length > 0 && <button className="chip" onClick={() => setHist(hist.filter((h) => h.fav))}>Clear unstarred</button>}</div>
          {hist.length === 0 && <p className="muted">No calculations yet. Press = on the calculator to save one here.</p>}
          <ul className="hist">
            {[...hist].sort((a, b) => b.fav - a.fav).map((h) => (
              <li key={h.id}>
                <button className="use" onClick={() => { setExpr(h.raw); setDone(true); setTab('calc') }}>
                  <span className="muted">{h.e}</span><strong>= {h.r}</strong>
                </button>
                <button className={'star' + (h.fav ? ' on' : '')} aria-label="Favorite" onClick={() => setHist(hist.map((x) => x.id === h.id ? { ...x, fav: !x.fav } : x))}>★</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'settings' && (
        <section className="panel">
          <h2>Settings</h2>
          <label>Theme
            <div className="seg">{['system', 'light', 'dark'].map((t) => <button key={t} className={st.theme === t ? 'on' : ''} onClick={() => setSt({ ...st, theme: t })}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>
          </label>
          <label>Angle unit
            <div className="seg">{[[true, 'Degrees'], [false, 'Radians']].map(([v, n]) => <button key={n} className={st.deg === v ? 'on' : ''} onClick={() => setSt({ ...st, deg: v })}>{n}</button>)}</div>
          </label>
          <label>Decimal places: <b>{st.prec}</b>
            <input type="range" min="0" max="8" value={st.prec} onChange={(e) => setSt({ ...st, prec: +e.target.value })} />
          </label>
          <label className="row">Thousands separator
            <input type="checkbox" checked={st.sep} onChange={(e) => setSt({ ...st, sep: e.target.checked })} />
          </label>
          <p className="muted">Settings and history are saved in this browser only.</p>
        </section>
      )}
    </div>
  )
}
