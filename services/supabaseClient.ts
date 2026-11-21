
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iuqthvsrxwfilfderdmv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1cXRodnNyeHdmaWxmZGVyZG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMDczNzAsImV4cCI6MjA4MTc4MzM3MH0.uP9izXjDznIPsvDgNeojh8_Jfa632lBgaAARnLsCW_0';

export const supabase = createClient(supabaseUrl, supabaseKey);
