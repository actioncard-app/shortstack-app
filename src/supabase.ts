import { createClient } from '@supabase/supabase-js'
// Public (publishable) values only. Never put a service-role key in the client.
export const SUPABASE_URL = 'https://hsnwopektgtudzifmhur.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_9mC4BP6mS_c0w6V11BrbTg_TuGeabf8'
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY)
export const publicUrl = (path?: string | null) => path ? sb.storage.from('clips').getPublicUrl(path).data.publicUrl : ''
export type Profile = { id: string; username: string; display_name: string; bio: string; avatar_url: string | null; communities: string[]; is_admin: boolean; is_demo: boolean }
export type Video = { id: string; user_id: string; video_path: string; poster_path: string | null; caption: string; hashtags: string[]; status: string; is_demo: boolean; created_at: string; profiles?: Profile; likes?: { count: number }[]; comments?: { count: number }[] }
