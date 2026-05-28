import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bozbbnavvppsdycmyqna.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvemJibmF2dnBwc2R5Y215cW5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NjAxMDcsImV4cCI6MjA5NDEzNjEwN30.MefGhfGW0UaVAM-jZLphxm412r8N6QssymKvEpfxDpc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
