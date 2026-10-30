import { useEffect, useRef, useState, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import { sb, publicUrl, SUPABASE_URL, SUPABASE_KEY, type Profile, type Video } from './supabase'
import { BRAND, COMMUNITIES, LIMITS } from './brand'
import { RULES, ruleTitle } from './rules'

// ---------- tiny hash router ----------
function useRoute() {
  const [h, setH] = useState(location.hash.slice(1) || '/')
  useEffect(() => { const f = () => setH(location.hash.slice(1) || '/'); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  return h
}
export const go = (p: string) => { location.hash = p }

// ---------- toast ----------
let toastFn: (m: string) => void = () => {}
export const toast = (m: string) => toastFn(m)
function Toast() {
  const [m, setM] = useState('')
  useEffect(() => { toastFn = (x) => { setM(x); setTimeout(() => setM(''), 2500) } }, [])
  return m ? <div className="toast" role="status">{m}</div> : null
}

const VIDEO_SELECT = '*, profiles!videos_user_id_fkey(*), likes(count), comments(count)'
const shareUrl = (id: string) => `${location.origin}${location.pathname}#/v/${id}`

export default function App() {
  const route = useRoute()
  const [session, setSession] = useState<Session | null>(null)
  const [me, setMe] = useState<Profile | null>(null)
  const [ready, setReady] = useState(false)
  const loadMe = useCallback(async (uid?: string) => {
    if (!uid) { setMe(null); return }
    const { data } = await sb.from('profiles').select('*').eq('id', uid).single()
    setMe(data as Profile)
  }, [])
  useEffect(() => {
    sb.auth.getSession().then(async ({ data }) => { setSession(data.session); await loadMe(data.session?.user.id); setReady(true) })
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => { setSession(s); loadMe(s?.user.id) })
    return () => sub.subscription.unsubscribe()
  }, [loadMe])

  if (!ready) return <div className="center">Loading…</div>
  const parts = route.split('/').filter(Boolean)
  let page: React.ReactNode
  if (parts[0] === 'rules') page = <Rules />
  else if (parts[0] === 'v' && parts[1]) page = <SingleClip id={parts[1]} me={me} />
  else if (!session || !me) page = <Auth />
  else if (parts[0] === 'new') page = <Upload me={me} />
  else if (parts[0] === 'u' && parts[1]) page = <ProfilePage username={parts[1]} me={me} />
  else if (parts[0] === 'edit') page = <EditProfile me={me} onSaved={() => loadMe(me.id)} />
  else if (parts[0] === 'notices') page = <Notices me={me} />
  else if (parts[0] === 'admin') page = me.is_admin ? <Admin /> : <div className="center">Admins only.</div>
  else page = <Feed me={me} />
  return <div className="app">{page}{session && me && <Nav me={me} route={route} />}<Toast /></div>
}

function Nav({ me, route }: { me: Profile; route: string }) {
  const [n, setN] = useState(0)
  useEffect(() => { sb.from('takedowns').select('id', { count: 'exact', head: true }).eq('creator_id', me.id).eq('appeal_status', 'none').then(({ count }) => setN(count ?? 0)) }, [me.id, route])
  const a = (p: string) => (route === p || (p !== '/' && route.startsWith(p)) ? 'on' : '')
  return <nav className="nav">
    <a className={a('/')} href="#/">Home</a>
    <a className={'plus ' + a('/new')} href="#/new" aria-label="New clip">＋</a>
    <a className={a('/notices')} href="#/notices">Notices{n > 0 && <span className="badge">{n}</span>}</a>
    <a className={a('/u/' + me.username)} href={'#/u/' + me.username}>Me</a>
  </nav>
}

// ---------- auth ----------
function Auth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [f, setF] = useState({ email: '', password: '', username: '', display_name: '', age_18: false, terms: false })
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const set = (k: string, v: unknown) => setF({ ...f, [k]: v })
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      if (mode === 'signup') {
        if (!f.age_18) throw new Error('You must be 18 or older to join.')
        if (!f.terms) throw new Error('Please accept the community rules and terms.')
        const r = await fetch(`${SUPABASE_URL}/functions/v1/signup`, { method: 'POST', headers: { 'content-type': 'application/json', apikey: SUPABASE_KEY }, body: JSON.stringify(f) })
        const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Sign-up failed')
      }
      const { error } = await sb.auth.signInWithPassword({ email: f.email, password: f.password })
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message)
      go('/')
    } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  return <div className="auth">
    <h1 className="logo">{BRAND.logoText}</h1>
    <p className="muted">{BRAND.tagline}</p>
    <form onSubmit={submit}>
      <input aria-label="Email" placeholder="Email" type="email" required value={f.email} onChange={e => set('email', e.target.value)} />
      <input aria-label="Password" placeholder="Password (8+ characters)" type="password" required minLength={8} value={f.password} onChange={e => set('password', e.target.value)} />
      {mode === 'signup' && <>
        <input aria-label="Username" placeholder="Username (a-z, 0-9, _)" required pattern="[a-z0-9_]{3,24}" value={f.username} onChange={e => set('username', e.target.value.toLowerCase())} />
        <input aria-label="Display name" placeholder="Display name" value={f.display_name} onChange={e => set('display_name', e.target.value)} />
        <label className="check"><input type="checkbox" checked={f.age_18} onChange={e => set('age_18', e.target.checked)} /> I'm 18 or older</label>
        <label className="check"><input type="checkbox" checked={f.terms} onChange={e => set('terms', e.target.checked)} /> I agree to the <a href="#/rules" target="_blank">community rules and terms</a></label>
      </>}
      {err && <p className="err" role="alert">{err}</p>}
      <button className="primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</button>
    </form>
    <button className="link" onClick={() => { setErr(''); setMode(mode === 'login' ? 'signup' : 'login') }}>{mode === 'login' ? "New here? Create an account" : 'Have an account? Log in'}</button>
    <a className="link" href="#/rules">Community rules</a>
  </div>
}

// ---------- feed ----------
async function myBlocks(uid?: string) {
  if (!uid) return new Set<string>()
  const { data } = await sb.from('blocks').select('blocked_id').eq('blocker_id', uid)
  return new Set((data ?? []).map(b => b.blocked_id as string))
}

function Feed({ me }: { me: Profile }) {
  const [tab, setTab] = useState<'foryou' | 'following'>('foryou')
  const [vids, setVids] = useState<Video[] | null>(null)
  const [muted, setMuted] = useState(true)
  const load = useCallback(async () => {
    setVids(null)
    const blocked = await myBlocks(me.id)
    let q = sb.from('videos').select(VIDEO_SELECT).eq('status', 'active').order('created_at', { ascending: false }).limit(50)
    if (tab === 'following') {
      const { data: f } = await sb.from('follows').select('following_id').eq('follower_id', me.id)
      const ids = (f ?? []).map(x => x.following_id)
      if (!ids.length) { setVids([]); return }
      q = q.in('user_id', ids)
    }
    const { data, error } = await q
    if (error) toast(error.message)
    setVids(((data ?? []) as Video[]).filter(v => !blocked.has(v.user_id)))
  }, [tab, me.id])
  useEffect(() => { load() }, [load])
  return <div className="feedwrap">
    <div className="tabs">
      <button className={tab === 'following' ? 'on' : ''} onClick={() => setTab('following')}>Following</button>
      <button className={tab === 'foryou' ? 'on' : ''} onClick={() => setTab('foryou')}>For You</button>
      <button className="mute" aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted(!muted)}>{muted ? '🔇' : '🔊'}</button>
    </div>
    {vids === null ? <div className="center">Loading…</div> : vids.length === 0 ? <div className="center">{tab === 'following' ? 'Follow some creators to fill this tab.' : 'No clips yet. Be the first!'}</div> :
      <div className="feed" data-testid="feed">{vids.map(v => <ClipCard key={v.id} v={v} me={me} muted={muted} onGone={load} />)}</div>}
  </div>
}

function SingleClip({ id, me }: { id: string; me: Profile | null }) {
  const [v, setV] = useState<Video | null | undefined>(undefined)
  const [muted, setMuted] = useState(true)
  useEffect(() => { sb.from('videos').select(VIDEO_SELECT).eq('id', id).maybeSingle().then(({ data }) => setV(data as Video | null)) }, [id])
  if (v === undefined) return <div className="center">Loading…</div>
  if (!v) return <div className="center">This clip isn't available. It may have been removed.<br /><a href="#/">Go home</a></div>
  return <div className="feedwrap">
    <div className="tabs"><a href="#/" className="back">← {BRAND.name}</a><button className="mute" aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted(!muted)}>{muted ? '🔇' : '🔊'}</button></div>
    <div className="feed"><ClipCard v={v} me={me} muted={muted} onGone={() => go('/')} /></div>
    {!me && <div className="signup-banner"><a href="#/">Log in or sign up</a> to like, comment and follow.</div>}
  </div>
}

function ClipCard({ v, me, muted, onGone }: { v: Video; me: Profile | null; muted: boolean; onGone: () => void }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [liked, setLiked] = useState(false)
  const [likes, setLikes] = useState(v.likes?.[0]?.count ?? 0)
  const [nComments, setNComments] = useState(v.comments?.[0]?.count ?? 0)
  const [sheet, setSheet] = useState<'' | 'comments' | 'more' | 'report'>('')
  useEffect(() => { if (me) sb.from('likes').select('video_id').eq('video_id', v.id).eq('user_id', me.id).maybeSingle().then(({ data }) => setLiked(!!data)) }, [v.id, me])
  useEffect(() => {
    const el = ref.current!; const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && e.intersectionRatio > 0.6) el.play().catch(() => {}); else el.pause() }, { threshold: [0, 0.6, 1] })
    io.observe(el); return () => io.disconnect()
  }, [])
  async function toggleLike() {
    if (!me) return go('/')
    if (liked) { setLiked(false); setLikes(l => l - 1); await sb.from('likes').delete().eq('video_id', v.id).eq('user_id', me.id) }
    else { setLiked(true); setLikes(l => l + 1); const { error } = await sb.from('likes').insert({ video_id: v.id, user_id: me.id }); if (error) toast(error.message) }
  }
  async function share() {
    const url = shareUrl(v.id)
    try { if (navigator.share) { await navigator.share({ title: BRAND.name, text: v.caption, url }); return } } catch { /* cancelled */ }
    try { await navigator.clipboard.writeText(url); toast('Link copied') } catch { prompt('Copy this link', url) }
  }
  async function block() {
    if (!me) return go('/')
    const { error } = await sb.from('blocks').insert({ blocker_id: me.id, blocked_id: v.user_id })
    toast(error ? error.message : `Blocked @${v.profiles?.username}. You won't see their clips.`); setSheet(''); if (!error) onGone()
  }
  const p = v.profiles
  return <section className="clip" data-testid="clip" data-id={v.id}>
    <video ref={ref} src={publicUrl(v.video_path)} poster={publicUrl(v.poster_path) || undefined} loop playsInline muted={muted} preload="metadata" onClick={e => { const el = e.currentTarget; if (el.paused) el.play(); else el.pause() }} />
    {v.status === 'removed' && <div className="removed-tag">Removed — only you and admins can see this</div>}
    <div className="side">
      <a href={'#/u/' + p?.username} className="av" aria-label="Creator profile">{p?.avatar_url ? <img src={p.avatar_url} alt="" /> : (p?.display_name || p?.username || '?')[0].toUpperCase()}</a>
      <button aria-label="Like" aria-pressed={liked} className={liked ? 'liked' : ''} onClick={toggleLike}>❤<span data-testid="like-count">{likes}</span></button>
      <button aria-label="Comments" onClick={() => setSheet('comments')}>💬<span>{nComments}</span></button>
      <button aria-label="Share" onClick={share}>↗<span>Share</span></button>
      <button aria-label="More" onClick={() => setSheet('more')}>⋯</button>
    </div>
    <div className="meta">
      <a href={'#/u/' + p?.username}><b>@{p?.username}</b></a>{v.is_demo && <span className="demo">DEMO</span>}
      <p>{v.caption} {v.hashtags.map(h => <span key={h} className="tag">#{h} </span>)}</p>
    </div>
    {sheet === 'comments' && <Comments v={v} me={me} onClose={() => setSheet('')} onCount={setNComments} />}
    {sheet === 'more' && <Sheet onClose={() => setSheet('')} title="Options">
      <button className="row" onClick={() => setSheet('report')}>⚑ Report this clip</button>
      {me && me.id !== v.user_id && <button className="row" onClick={block}>⛔ Block @{p?.username}</button>}
      <button className="row" onClick={() => { navigator.clipboard?.writeText(shareUrl(v.id)); toast('Link copied'); setSheet('') }}>🔗 Copy link</button>
    </Sheet>}
    {sheet === 'report' && <ReportSheet v={v} me={me} onClose={() => setSheet('')} />}
  </section>
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="sheet-bg" onClick={onClose}><div className="sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label={title}>
    <div className="sheet-h"><b>{title}</b><button aria-label="Close" onClick={onClose}>✕</button></div>{children}</div></div>
}

type C = { id: string; body: string; created_at: string; user_id: string; profiles: { username: string } }
function Comments({ v, me, onClose, onCount }: { v: Video; me: Profile | null; onClose: () => void; onCount: (n: number) => void }) {
  const [list, setList] = useState<C[]>([]); const [t, setT] = useState('')
  const load = useCallback(async () => {
    const { data } = await sb.from('comments').select('id, body, created_at, user_id, profiles(username)').eq('video_id', v.id).order('created_at')
    setList((data ?? []) as unknown as C[]); onCount(data?.length ?? 0)
  }, [v.id, onCount])
  useEffect(() => { load() }, [load])
  async function send(e: React.FormEvent) {
    e.preventDefault(); if (!me) return go('/'); if (!t.trim()) return
    const { error } = await sb.from('comments').insert({ video_id: v.id, user_id: me.id, body: t.trim() })
    if (error) toast(error.message); else { setT(''); load() }
  }
  async function del(id: string) { await sb.from('comments').delete().eq('id', id); load() }
  return <Sheet title={`${list.length} comments`} onClose={onClose}>
    <div className="clist">{list.length === 0 && <p className="muted">No comments yet.</p>}
      {list.map(c => <div key={c.id} className="comment" data-testid="comment"><a href={'#/u/' + c.profiles?.username}><b>@{c.profiles?.username}</b></a> {c.body}
        {me?.id === c.user_id && <button className="link small" onClick={() => del(c.id)}>delete</button>}</div>)}</div>
    {me ? <form className="cform" onSubmit={send}><input aria-label="Add comment" placeholder="Add a comment…" maxLength={500} value={t} onChange={e => setT(e.target.value)} /><button className="primary">Post</button></form> : <p className="muted"><a href="#/">Log in</a> to comment.</p>}
  </Sheet>
}

function ReportSheet({ v, me, onClose }: { v: Video; me: Profile | null; onClose: () => void }) {
  const [rule, setRule] = useState(''); const [d, setD] = useState('')
  if (!me) return <Sheet title="Report" onClose={onClose}><p><a href="#/">Log in</a> to report.</p></Sheet>
  async function send() {
    if (!rule) return toast('Pick which rule it breaks')
    const { error } = await sb.from('reports').insert({ video_id: v.id, reporter_id: me!.id, rule, details: d })
    toast(error ? error.message : 'Thanks. A person will review this clip.'); if (!error) onClose()
  }
  return <Sheet title="Report clip" onClose={onClose}>
    <p className="muted">Which rule does it break? <a href="#/rules">Read the rules</a></p>
    {RULES.map(r => <label key={r.id} className="check"><input type="radio" name="rule" value={r.id} checked={rule === r.id} onChange={() => setRule(r.id)} /> {r.title}</label>)}
    <textarea aria-label="Report details" placeholder="Anything else? (optional)" maxLength={500} value={d} onChange={e => setD(e.target.value)} />
    <button className="primary" onClick={send}>Send report</button>
  </Sheet>
}

// ---------- upload ----------
function pickMime() {
  for (const m of ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']) if (MediaRecorder.isTypeSupported?.(m)) return m
  return ''
}
async function probe(blob: Blob): Promise<{ duration: number; poster: Blob | null }> {
  const url = URL.createObjectURL(blob); const el = document.createElement('video')
  el.muted = true; el.playsInline = true; el.preload = 'auto'; el.src = url
  await new Promise<void>((res, rej) => { el.onloadedmetadata = () => res(); el.onerror = () => rej(new Error("Couldn't read that video. Try MP4 or WebM.")) })
  let duration = el.duration
  if (!isFinite(duration)) { el.currentTime = 1e7; await new Promise(r => { el.ontimeupdate = r; setTimeout(r, 1500) }); duration = el.duration; }
  el.currentTime = Math.min(0.5, (isFinite(duration) ? duration : 1) / 2)
  await new Promise(r => { el.onseeked = r; setTimeout(r, 2000) })
  let poster: Blob | null = null
  try {
    const w = el.videoWidth || 360, h = el.videoHeight || 640, s = Math.min(1, 720 / Math.max(w, h))
    const c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s)
    c.getContext('2d')!.drawImage(el, 0, 0, c.width, c.height)
    poster = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8))
  } catch { poster = null }
  URL.revokeObjectURL(url)
  return { duration: isFinite(duration) ? duration : 0, poster }
}

function Upload({ me }: { me: Profile }) {
  const [blob, setBlob] = useState<Blob | null>(null)
  const [preview, setPreview] = useState('')
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(''); const [err, setErr] = useState('')
  const [rec, setRec] = useState<{ stream: MediaStream; mr: MediaRecorder | null; secs: number } | null>(null)
  const live = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  useEffect(() => () => streamRef.current?.getTracks().forEach(t => t.stop()), [])
  function useBlob(b: Blob) {
    setErr('')
    if (b.size > LIMITS.maxBytes) { setErr(`That file is ${(b.size / 1048576).toFixed(1)} MB. The limit is 25 MB — trim it or record a shorter clip.`); return }
    setBlob(b); setPreview(URL.createObjectURL(b))
  }
  async function openCam() {
    setErr('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } }, audio: true })
      streamRef.current = stream; setRec({ stream, mr: null, secs: 0 }); setTimeout(() => { if (live.current) { live.current.srcObject = stream; live.current.play() } }, 50)
    } catch { setErr('Camera not available. Allow camera access, or choose a file instead.') }
  }
  function start() {
    if (!rec) return
    const mime = pickMime(); const chunks: Blob[] = []
    const mr = new MediaRecorder(rec.stream, { mimeType: mime || undefined, videoBitsPerSecond: 1_500_000, audioBitsPerSecond: 96_000 })
    mr.ondataavailable = e => e.data.size && chunks.push(e.data)
    mr.onstop = () => { rec.stream.getTracks().forEach(t => t.stop()); useBlob(new Blob(chunks, { type: (mime || 'video/webm').split(';')[0] })); setRec(null) }
    mr.start(500)
    let s = 0; const iv = setInterval(() => { s++; setRec(r => r && { ...r, secs: s }); if (s >= LIMITS.maxSeconds || mr.state !== 'recording') { clearInterval(iv); if (mr.state === 'recording') mr.stop() } }, 1000)
    setRec({ ...rec, mr })
  }
  async function post() {
    if (!blob) return
    setErr(''); setBusy('Checking clip…')
    try {
      const { duration, poster } = await probe(blob)
      if (duration > LIMITS.maxSeconds + 0.5) throw new Error(`Clips can be up to ${LIMITS.maxSeconds} seconds. This one is ${Math.round(duration)}s.`)
      const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('quicktime') ? 'mov' : 'webm'
      const base = `${me.id}/${crypto.randomUUID()}`
      setBusy('Uploading…')
      const up = await sb.storage.from('clips').upload(`${base}.${ext}`, blob, { contentType: blob.type || 'video/webm' })
      if (up.error) throw up.error
      let poster_path: string | null = null
      if (poster) { const pu = await sb.storage.from('clips').upload(`${base}.jpg`, poster, { contentType: 'image/jpeg' }); if (!pu.error) poster_path = `${base}.jpg` }
      const hashtags = [...new Set((caption.match(/#([\p{L}\p{N}_]+)/gu) ?? []).map(h => h.slice(1).toLowerCase()))].slice(0, 10)
      const { data, error } = await sb.from('videos').insert({ user_id: me.id, video_path: `${base}.${ext}`, poster_path, caption: caption.replace(/#[\p{L}\p{N}_]+/gu, '').trim(), hashtags, duration_s: Math.round(duration * 10) / 10 || null }).select('id').single()
      if (error) throw error
      toast('Posted!'); go('/v/' + data.id)
    } catch (x) { setErr((x as Error).message) } finally { setBusy('') }
  }
  return <div className="page">
    <h2>New clip</h2>
    {rec ? <div className="rec">
      <video ref={live} muted playsInline className="preview" />
      {rec.mr ? <button className="primary" onClick={() => rec.mr!.stop()}>■ Stop ({rec.secs}s / {LIMITS.maxSeconds}s)</button> : <button className="primary" onClick={start}>● Start recording</button>}
      <button className="link" onClick={() => { rec.stream.getTracks().forEach(t => t.stop()); setRec(null) }}>Cancel</button>
    </div> : blob ? <>
      <video src={preview} className="preview" controls playsInline loop />
      <textarea aria-label="Caption" placeholder="Say something… add #hashtags" maxLength={300} value={caption} onChange={e => setCaption(e.target.value)} />
      <button className="primary" disabled={!!busy} onClick={post}>{busy || 'Post'}</button>
      <button className="link" onClick={() => { setBlob(null); setPreview('') }}>Start over</button>
    </> : <div className="choose">
      <button className="primary" onClick={openCam}>🎥 Record with camera</button>
      <label className="btn">📁 Choose a video<input type="file" accept="video/*" hidden data-testid="file" onChange={e => e.target.files?.[0] && useBlob(e.target.files[0])} /></label>
      <p className="muted">Up to {LIMITS.maxSeconds} seconds and 25 MB. Make sure it follows the <a href="#/rules">rules</a>.</p>
    </div>}
    {err && <p className="err" role="alert">{err}</p>}
  </div>
}

// ---------- profiles ----------
function ProfilePage({ username, me }: { username: string; me: Profile }) {
  const [p, setP] = useState<Profile | null | undefined>(undefined)
  const [vids, setVids] = useState<Video[]>([])
  const [counts, setCounts] = useState({ followers: 0, following: 0 })
  const [following, setFollowing] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const load = useCallback(async () => {
    const { data } = await sb.from('profiles').select('*').eq('username', username).maybeSingle()
    setP(data as Profile | null); if (!data) return
    const [v, a, b, f, bl] = await Promise.all([
      sb.from('videos').select('*').eq('user_id', data.id).order('created_at', { ascending: false }),
      sb.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', data.id),
      sb.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', data.id),
      sb.from('follows').select('follower_id').eq('follower_id', me.id).eq('following_id', data.id).maybeSingle(),
      sb.from('blocks').select('blocked_id').eq('blocker_id', me.id).eq('blocked_id', data.id).maybeSingle(),
    ])
    setVids((v.data ?? []) as Video[]); setCounts({ followers: a.count ?? 0, following: b.count ?? 0 }); setFollowing(!!f.data); setBlocked(!!bl.data)
  }, [username, me.id])
  useEffect(() => { load() }, [load])
  if (p === undefined) return <div className="center">Loading…</div>
  if (!p) return <div className="center">No such user.</div>
  const mine = p.id === me.id
  async function toggleFollow() {
    const r = following ? await sb.from('follows').delete().eq('follower_id', me.id).eq('following_id', p!.id) : await sb.from('follows').insert({ follower_id: me.id, following_id: p!.id })
    if (r.error) toast(r.error.message); load()
  }
  async function toggleBlock() {
    const r = blocked ? await sb.from('blocks').delete().eq('blocker_id', me.id).eq('blocked_id', p!.id) : await sb.from('blocks').insert({ blocker_id: me.id, blocked_id: p!.id })
    if (r.error) toast(r.error.message); else toast(blocked ? 'Unblocked' : `Blocked @${p!.username}`); load()
  }
  return <div className="page profile">
    <div className="phead">
      <div className="av big">{p.avatar_url ? <img src={p.avatar_url} alt="" /> : (p.display_name || p.username)[0].toUpperCase()}</div>
      <h2>{p.display_name || p.username}{p.is_demo && <span className="demo">DEMO</span>}</h2>
      <div className="muted">@{p.username}</div>
      <div className="stats"><span><b data-testid="followers">{counts.followers}</b> followers</span><span><b>{counts.following}</b> following</span><span><b>{vids.filter(v => v.status === 'active').length}</b> clips</span></div>
      {p.bio && <p>{p.bio}</p>}
      <div className="chips">{p.communities.map(c => <span key={c} className="chip">{COMMUNITIES.find(x => x.id === c)?.label ?? c}</span>)}</div>
      {mine ? <div className="row-btns"><a className="btn" href="#/edit">Edit profile</a>{me.is_admin && <a className="btn" href="#/admin">Admin review</a>}<button className="btn" onClick={async () => { await sb.auth.signOut(); go('/') }}>Log out</button></div>
        : <div className="row-btns"><button className={following ? 'btn' : 'primary'} onClick={toggleFollow}>{following ? 'Unfollow' : 'Follow'}</button><button className="btn" onClick={toggleBlock}>{blocked ? 'Unblock' : 'Block'}</button></div>}
    </div>
    <div className="shop" data-testid="shop">
      <b>🛍 Shop & tips — coming soon</b>
      <p className="muted">Creators will be able to sell items and get tips here, with a fairer pay split. <b>Not live yet. No real money moves.</b></p>
      <div className="row-btns"><button className="btn" disabled>Send a tip (coming soon)</button><button className="btn" disabled>Visit shop (coming soon)</button></div>
    </div>
    {blocked ? <p className="muted center">You blocked this user.</p> : <div className="grid">{vids.map(v => <a key={v.id} href={'#/v/' + v.id} className="cell">
      {v.poster_path ? <img src={publicUrl(v.poster_path)} alt={v.caption} /> : <video src={publicUrl(v.video_path)} muted preload="metadata" />}
      {v.status === 'removed' && <span className="removed-tag">Removed</span>}</a>)}</div>}
    <p className="foot"><a href="#/rules">Community rules</a></p>
  </div>
}

function EditProfile({ me, onSaved }: { me: Profile; onSaved: () => void }) {
  const [f, setF] = useState({ display_name: me.display_name, bio: me.bio, communities: me.communities, avatar_url: me.avatar_url })
  const [busy, setBusy] = useState(false)
  async function avatar(file: File) {
    if (file.size > 5 * 1048576) return toast('Pick a photo under 5 MB')
    const path = `${me.id}/avatar-${Date.now()}.${file.type.includes('png') ? 'png' : 'jpg'}`
    const { error } = await sb.storage.from('clips').upload(path, file, { contentType: file.type })
    if (error) return toast(error.message)
    setF({ ...f, avatar_url: publicUrl(path) })
  }
  async function save() {
    setBusy(true)
    const { error } = await sb.from('profiles').update(f).eq('id', me.id)
    setBusy(false); if (error) return toast(error.message)
    onSaved(); toast('Saved'); go('/u/' + me.username)
  }
  const tog = (c: string) => setF({ ...f, communities: f.communities.includes(c) ? f.communities.filter(x => x !== c) : [...f.communities, c] })
  return <div className="page">
    <h2>Edit profile</h2>
    <label className="btn">Change photo<input type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && avatar(e.target.files[0])} /></label>
    {f.avatar_url && <img src={f.avatar_url} className="av big" alt="avatar" />}
    <input aria-label="Display name" placeholder="Display name" maxLength={50} value={f.display_name} onChange={e => setF({ ...f, display_name: e.target.value })} />
    <textarea aria-label="Bio" placeholder="Bio" maxLength={300} value={f.bio} onChange={e => setF({ ...f, bio: e.target.value })} />
    <p className="muted">Your communities</p>
    <div className="chips">{COMMUNITIES.map(c => <button key={c.id} className={'chip ' + (f.communities.includes(c.id) ? 'on' : '')} onClick={() => tog(c.id)}>{c.label}</button>)}</div>
    <button className="primary" disabled={busy} onClick={save}>Save</button>
  </div>
}

// ---------- rules ----------
function Rules() {
  return <div className="page">
    <a href="#/">← Back</a>
    <h2>{BRAND.name} community rules</h2>
    <p>Plain rules, real reasons. If we ever take a clip down, we'll tell you <b>which clip</b>, <b>which rule</b>, and <b>why</b> — and you can appeal with one tap. A person reads every appeal.</p>
    <ol className="rules">{RULES.map(r => <li key={r.id}><b>{r.title}.</b> <span className="muted">Why: {r.why}</span></li>)}</ol>
    <h3>Terms (short version)</h3>
    <ul><li>You must be 18 or older.</li><li>You own what you post. You let {BRAND.name} show it in the app.</li><li>Shop and tips are not live yet. No money moves in this version.</li><li>This is an early test version. Things may break or be reset.</li></ul>
  </div>
}

// ---------- notices + appeal ----------
type TD = { id: string; video_id: string; rule: string; reason: string; appeal_text: string | null; appeal_status: string; appeal_response: string | null; created_at: string; videos: { caption: string; created_at: string; poster_path: string | null } }
function Notices({ me }: { me: Profile }) {
  const [list, setList] = useState<TD[] | null>(null)
  const [open, setOpen] = useState(''); const [t, setT] = useState('')
  const load = useCallback(async () => {
    const { data } = await sb.from('takedowns').select('*, videos(caption, created_at, poster_path)').eq('creator_id', me.id).order('created_at', { ascending: false })
    setList((data ?? []) as unknown as TD[])
  }, [me.id])
  useEffect(() => { load() }, [load])
  async function appeal(id: string) {
    const { error } = await sb.rpc('submit_appeal', { p_takedown: id, p_text: t })
    if (error) return toast(error.message); toast('Appeal sent. A person will review it.'); setOpen(''); setT(''); load()
  }
  return <div className="page">
    <h2>Notices</h2>
    {list === null ? <p>Loading…</p> : list.length === 0 ? <p className="muted">Nothing here. When something happens to your clips, you'll see it here with the exact reason.</p> :
      list.map(n => <div key={n.id} className="notice" data-testid="notice">
        <b>Your clip was removed</b>
        <p>Clip: “{n.videos?.caption || '(no caption)'}” posted {new Date(n.videos?.created_at).toLocaleDateString()} — <a href={'#/v/' + n.video_id}>view</a></p>
        <p>Rule broken: <b>{ruleTitle(n.rule)}</b></p>
        <p>Why: {n.reason}</p>
        <p className="muted">Removed {new Date(n.created_at).toLocaleString()}</p>
        {n.appeal_status === 'none' ? (open === n.id ? <div><textarea aria-label="Appeal reason" placeholder="Tell us why this should come back" value={t} onChange={e => setT(e.target.value)} /><button className="primary" onClick={() => appeal(n.id)}>Send appeal</button></div>
          : <button className="primary" onClick={() => setOpen(n.id)}>Appeal</button>)
          : <p className="status">Appeal: <b>{n.appeal_status === 'pending' ? 'waiting for review' : n.appeal_status === 'restored' ? 'accepted — clip restored' : 'reviewed — removal stands'}</b>{n.appeal_response && <> — “{n.appeal_response}”</>}</p>}
      </div>)}
  </div>
}

// ---------- admin ----------
type R = { id: string; video_id: string; rule: string; details: string; created_at: string; videos: Video & { profiles: Profile } }
function Admin() {
  const [reports, setReports] = useState<R[]>([]); const [appeals, setAppeals] = useState<(TD & { creator_id: string })[]>([])
  const [form, setForm] = useState<Record<string, { rule: string; reason: string }>>({})
  const load = useCallback(async () => {
    const [r, a] = await Promise.all([
      sb.from('reports').select('*, videos(*, profiles!videos_user_id_fkey(*))').eq('status', 'open').order('created_at'),
      sb.from('takedowns').select('*, videos(caption, created_at, poster_path)').eq('appeal_status', 'pending').order('appealed_at'),
    ])
    setReports((r.data ?? []) as unknown as R[]); setAppeals((a.data ?? []) as never)
  }, [])
  useEffect(() => { load() }, [load])
  const byVideo = new Map<string, R[]>(); reports.forEach(r => byVideo.set(r.video_id, [...(byVideo.get(r.video_id) ?? []), r]))
  async function takeDown(vid: string) {
    const f = form[vid]; if (!f?.rule || !f?.reason?.trim()) return toast('Pick the rule and write the reason the creator will see')
    const { error } = await sb.rpc('take_down', { p_video: vid, p_rule: f.rule, p_reason: f.reason.trim() })
    toast(error ? error.message : 'Clip removed. Creator was notified.'); load()
  }
  async function dismiss(vid: string) { const { error } = await sb.rpc('dismiss_reports', { p_video: vid }); toast(error ? error.message : 'Dismissed'); load() }
  async function decide(id: string, restore: boolean) {
    const resp = prompt(restore ? 'Note to creator (why it is restored):' : 'Note to creator (why removal stands):') ?? ''
    const { error } = await sb.rpc('decide_appeal', { p_takedown: id, p_restore: restore, p_response: resp }); toast(error ? error.message : 'Done'); load()
  }
  return <div className="page">
    <h2>Admin review</h2>
    <h3>Open reports ({byVideo.size} clips)</h3>
    {byVideo.size === 0 && <p className="muted">No open reports.</p>}
    {[...byVideo.entries()].map(([vid, rs]) => { const v = rs[0].videos; const f = form[vid] ?? { rule: rs[0].rule, reason: '' }; return <div key={vid} className="notice" data-testid="report-item">
      <div className="adminrow"><video src={publicUrl(v?.video_path)} poster={publicUrl(v?.poster_path) || undefined} controls muted playsInline />
        <div><b>@{v?.profiles?.username}</b>: “{v?.caption}”<ul>{rs.map(r => <li key={r.id}>{ruleTitle(r.rule)}{r.details && ` — ${r.details}`}</li>)}</ul></div></div>
      <select aria-label="Rule broken" value={f.rule} onChange={e => setForm({ ...form, [vid]: { ...f, rule: e.target.value } })}>{RULES.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select>
      <textarea aria-label="Reason for creator" placeholder="Reason the creator will see (be specific)" value={f.reason} onChange={e => setForm({ ...form, [vid]: { ...f, reason: e.target.value } })} />
      <div className="row-btns"><button className="primary" onClick={() => takeDown(vid)}>Take down</button><button className="btn" onClick={() => dismiss(vid)}>Dismiss (no violation)</button></div>
    </div> })}
    <h3>Appeals ({appeals.length})</h3>
    {appeals.length === 0 && <p className="muted">No pending appeals.</p>}
    {appeals.map(a => <div key={a.id} className="notice" data-testid="appeal-item">
      <p>Clip “{a.videos?.caption}” — <a href={'#/v/' + a.video_id}>view</a></p><p>Rule: <b>{ruleTitle(a.rule)}</b>. Reason given: {a.reason}</p><p>Creator says: “{a.appeal_text}”</p>
      <div className="row-btns"><button className="primary" onClick={() => decide(a.id, true)}>Restore clip</button><button className="btn" onClick={() => decide(a.id, false)}>Keep removed</button></div>
    </div>)}
  </div>
}
