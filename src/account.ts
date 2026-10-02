import { useEffect } from "react";
import { useAuth } from "./auth";
import { useStore } from "./store";

/**
 * Learning data lives on the device (one persisted store), and a phone is often shared. So the store belongs to
 * one account at a time: signing out sets it aside under that account and clears the screen for the next person;
 * signing back in on this device brings it back. A guest's data is adopted by the first account that signs in.
 */
const KEY = "gapfinder-v1";
const aside = (uid: string) => `hopper-device:${uid}`;

/** Before signing out: keep this account's data on the device, then clear the store. */
export function setAsideFor(uid: string) {
  const raw = localStorage.getItem(KEY);
  if (raw) localStorage.setItem(aside(uid), raw);
  useStore.getState().resetDemo();
}

/** When an account signs in: restore what it set aside here, or adopt what's on screen if nobody owns it yet. */
export function useDeviceAccount() {
  const uid = useAuth((s) => s.user?.id ?? null);
  useEffect(() => {
    if (!uid) return;
    const { owner, demo, consent } = useStore.getState();
    if (owner === uid || demo) return;
    if (owner) setAsideFor(owner); // another account's data is still here: keep it for them
    const saved = localStorage.getItem(aside(uid));
    if (saved) {
      localStorage.setItem(KEY, saved);
      localStorage.removeItem(aside(uid));
      void useStore.persist.rehydrate();
    }
    // Signing in on this device was itself the consent (the landing says so), so a switch of account keeps it;
    // otherwise the reset above would bounce the new account back to the landing page.
    const s = useStore.getState();
    s.set({ owner: uid, consent: s.consent ?? consent ?? { by: "self", at: Date.now() } });
  }, [uid]);
}
