// Uploads the ffmpeg-generated demo clips as the demo account. Password comes from .env.test (never committed).
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import ws from 'ws'
const sb = createClient('https://hsnwopektgtudzifmhur.supabase.co', 'sb_publishable_9mC4BP6mS_c0w6V11BrbTg_TuGeabf8', { realtime: { transport: ws } })
const { data: s, error } = await sb.auth.signInWithPassword({ email: 'demo@shortstack.test', password: process.env.DEMO_PW })
if (error) throw error
const uid = s.user.id
for (let i = 5; i >= 1; i--) {
  const [title, tags] = fs.readFileSync(`seed/demo${i}.txt`, 'utf8').trim().split('|')
  const base = `${uid}/demo${i}`
  for (const [ext, type] of [['mp4', 'video/mp4'], ['jpg', 'image/jpeg']]) {
    const r = await sb.storage.from('clips').upload(`${base}.${ext}`, fs.readFileSync(`seed/demo${i}.${ext}`), { contentType: type, upsert: false })
    if (r.error && !/exists/i.test(r.error.message)) throw r.error
  }
  const r = await sb.from('videos').insert({ user_id: uid, video_path: `${base}.mp4`, poster_path: `${base}.jpg`, caption: `Demo clip: ${title} (test pattern)`, hashtags: tags.split(' ').map(t => t.slice(1)).concat('demo'), duration_s: 8 })
  if (r.error) throw r.error
  console.log('seeded', title)
}
