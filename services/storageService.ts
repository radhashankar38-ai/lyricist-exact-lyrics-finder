import { User } from '../types';
import { supabase } from './supabaseClient';

// Unique salt for the application encryption
const APP_SALT = 'LYRICIST_SECURE_VAULT_v1';

/**
 * XOR Cipher for synchronous client-side encryption.
 * This obfuscates data to prevent plain-text reading in LocalStorage.
 */
const cipher = (salt: string) => {
    const textToChars = (text: string) => text.split('').map(c => c.charCodeAt(0));
    const byteHex = (n: number) => ("0" + Number(n).toString(16)).slice(-2);
    const applySaltToChar = (code: number) => textToChars(salt).reduce((a, b) => a ^ b, code);

    return (text: string) => text.split('')
        .map(c => c.charCodeAt(0))
        .map(applySaltToChar)
        .map(byteHex)
        .join('');
};

const decipher = (salt: string) => {
    const textToChars = (text: string) => text.split('').map(c => c.charCodeAt(0));
    const applySaltToChar = (code: number) => textToChars(salt).reduce((a, b) => a ^ b, code);
    return (encoded: string) => {
        // Handle empty or invalid input
        if (!encoded) return '';
        try {
            return encoded
                .match(/.{1,2}/g)!
                .map(hex => parseInt(hex, 16))
                .map(applySaltToChar)
                .map(charCode => String.fromCharCode(charCode))
                .join('');
        } catch (e) {
            // Fallback for corrupted data
            console.error("Decipher error", e);
            return '';
        }
    }
}

const encrypt = cipher(APP_SALT);
const decrypt = decipher(APP_SALT);

// Helper to generate storage keys based on user context
const getStorageKey = (key: string, user: User | null) => {
    if (user) {
        if (user.id && user.provider === 'supabase') {
             return `lyricist_supa_${user.id}_${key}`;
        }
        if (user.email) {
            const safeId = user.email.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            return `lyricist_${safeId}_${key}`;
        }
        const safeUser = user.username.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        return `lyricist_user_${safeUser}_${key}`;
    }
    return `lyricist_guest_${key}`;
};

export const storageService = {
    /**
     * Save the user session securely locally.
     * Note: Supabase session is handled by the client, this is for the App's user context object.
     */
    saveUser: (user: User | null) => {
        if (!user) {
            localStorage.removeItem('lyricist_user');
            return;
        }
        try {
            const json = JSON.stringify(user);
            const encrypted = encrypt(json);
            localStorage.setItem('lyricist_user', encrypted);
        } catch (e) {
            console.error("Failed to save user securely", e);
        }
    },

    /**
     * Retrieve and decrypt the user session.
     */
    getUser: (): User | null => {
        const raw = localStorage.getItem('lyricist_user');
        if (!raw) return null;

        try {
            // Attempt 1: Decrypt
            const decrypted = decrypt(raw);
            if (decrypted) {
                return JSON.parse(decrypted);
            }
            throw new Error("Decryption result empty");
        } catch (e) {
            // Attempt 2: Fallback to plain text (Migration for existing users)
            try {
                return JSON.parse(raw);
            } catch (err) {
                return null;
            }
        }
    },

    /**
     * Save data (History, Favorites, Settings, etc) securely.
     * If user is authenticated via Supabase, it attempts to sync remotely.
     */
    saveData: async (key: string, data: any, user: User | null) => {
        // 1. Save locally (Always cache)
        const storageKey = getStorageKey(key, user);
        try {
            const json = JSON.stringify(data);
            const encrypted = encrypt(json);
            localStorage.setItem(storageKey, encrypted);
        } catch (e) {
            console.error(`Failed to save ${key} locally`, e);
        }

        // 2. Sync Remotely if Supabase User
        if (user && user.provider === 'supabase' && user.id) {
            try {
                // Upsert to user_data table. 
                // Table schema expected: user_id (uuid), key (text), value (jsonb)
                const { error } = await supabase
                    .from('user_data')
                    .upsert({ user_id: user.id, key: key, value: data }, { onConflict: 'user_id,key' });
                
                if (error) {
                    console.warn(`Failed to sync ${key} to Supabase:`, error.message);
                }
            } catch (e) {
                // Silent fail for offline/table missing
            }
        }
    },

    /**
     * Retrieve list data locally (Enforces Array return).
     */
    getData: (key: string, user: User | null): any[] => {
        const storageKey = getStorageKey(key, user);
        const raw = localStorage.getItem(storageKey);
        if (!raw) return [];

        try {
            const decrypted = decrypt(raw);
            if (decrypted) {
                const parsed = JSON.parse(decrypted);
                return Array.isArray(parsed) ? parsed : [];
            }
            throw new Error("Decryption empty");
        } catch (e) {
            try {
                const parsed = JSON.parse(raw);
                return Array.isArray(parsed) ? parsed : [];
            } catch (err) {
                return [];
            }
        }
    },

    /**
     * Retrieve single value data locally (Settings, Strings, etc).
     */
    getValue: (key: string, user: User | null): any => {
        const storageKey = getStorageKey(key, user);
        const raw = localStorage.getItem(storageKey);
        if (!raw) return null;

        try {
            const decrypted = decrypt(raw);
            if (decrypted) {
                return JSON.parse(decrypted);
            }
            throw new Error("Decryption empty");
        } catch (e) {
            try {
                return JSON.parse(raw);
            } catch (err) {
                return null;
            }
        }
    },

    /**
     * Fetch remote data from Supabase (Generic).
     */
    getRemoteData: async (key: string, user: User | null): Promise<any[] | null> => {
        if (!user || user.provider !== 'supabase' || !user.id) return null;

        try {
            const { data, error } = await supabase
                .from('user_data')
                .select('value')
                .eq('user_id', user.id)
                .eq('key', key)
                .single();

            if (error || !data) return null;
            return Array.isArray(data.value) ? data.value : null;
        } catch (e) {
            return null;
        }
    },

    /**
     * Fetch remote single value from Supabase.
     */
    getRemoteValue: async (key: string, user: User | null): Promise<any> => {
        if (!user || user.provider !== 'supabase' || !user.id) return null;

        try {
            const { data, error } = await supabase
                .from('user_data')
                .select('value')
                .eq('user_id', user.id)
                .eq('key', key)
                .single();

            if (error || !data) return null;
            return data.value;
        } catch (e) {
            return null;
        }
    }
};