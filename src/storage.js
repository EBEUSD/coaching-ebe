import { getStorage } from 'firebase/storage';
import { app } from './firebase';

// Solo lo importan las pantallas que suben archivos (Biblioteca, Playbook).
export const storage = getStorage(app);
