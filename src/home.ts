/* The phone Home test (his ask, Oct 24): an opt-in apps home that opens
   first on phone. Stored like every preference (`eumae:homeScreen`, JSON)
   so Settings' useStored writes the same key. One event tells App. */
export const HOME_EVENT = 'eumae:home';
const KEY = 'eumae:homeScreen';

export function homeOn(): boolean {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'false') === true;
  } catch {
    return false;
  }
}

export function setHomeOn(on: boolean): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(on));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(HOME_EVENT));
}

export const isPhone = () => window.matchMedia('(max-width:899px)').matches;

/* The desktop Home (his ask, Oct 26, mockup IMG_5131): apps on a desktop,
   the open app in a window, Eumae beside it, a dock. Opt-in, desktop only. */
const DESK = 'eumae:deskHome';

export function deskOn(): boolean {
  try {
    return JSON.parse(localStorage.getItem(DESK) ?? 'false') === true;
  } catch {
    return false;
  }
}

export function setDeskOn(on: boolean): void {
  try {
    localStorage.setItem(DESK, JSON.stringify(on));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(HOME_EVENT));
}
