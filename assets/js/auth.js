// Grainley Foods customer accounts (Firebase Auth email/password + Firestore profiles)
// The Firebase web config below is a public identifier, not a secret; access is controlled by Firestore rules.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, sendEmailVerification, updateProfile, signOut, deleteUser,
  setPersistence, browserLocalPersistence, EmailAuthProvider, reauthenticateWithCredential
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDj9_75vxBwJy0MIjDRHf1mgkyR8blYbwc',
  authDomain: 'grainley-website.firebaseapp.com',
  projectId: 'grainley-website',
  storageBucket: 'grainley-website.firebasestorage.app',
  messagingSenderId: '343506979027',
  appId: '1:343506979027:web:97dd4664132c0344bb6c26'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

const ROOT = document.documentElement.getAttribute('data-root') || '';
const $ = (s, el) => (el || document).querySelector(s);
const page = document.body.dataset.page;
const WKEY = 'grainley-wishlist';
const localWish = () => { try { return JSON.parse(localStorage.getItem(WKEY) || '[]'); } catch (e) { return []; } };
const setLocalWish = (v) => { try { localStorage.setItem(WKEY, JSON.stringify(v)); } catch (e) {} };

const ERR = {
  'auth/email-already-in-use': 'An account with this email already exists. Try logging in instead.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/weak-password': 'Please choose a password with at least 8 characters.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/network-request-failed': 'No internet connection. Please check and try again.',
  'auth/requires-recent-login': 'For your security, please enter your password again.'
};
const msg = (e) => ERR[e && e.code] || 'Something went wrong. Please try again.';
function show(el, text, ok) { if (!el) return; el.textContent = text; el.className = 'form-msg ' + (ok ? 'ok' : 'err'); el.hidden = false; }
function busy(btn, on, label) { if (!btn) return; btn.disabled = on; if (label) btn.textContent = on ? 'Please wait…' : label; }
const next = () => { const n = new URLSearchParams(location.search).get('next'); return n && /^[\w\-./]+\.html$/.test(n) ? ROOT + n : ROOT + 'account.html'; };

// ---------- header account link ----------
function paintHeader(user, profile) {
  document.querySelectorAll('.acct-link').forEach((a) => {
    const label = a.querySelector('.acct-label');
    if (user) { a.href = ROOT + 'account.html'; a.setAttribute('aria-label', 'My account'); if (label) label.textContent = 'Hi, ' + ((profile && profile.name) || user.displayName || 'there').split(' ')[0]; }
    else { a.href = ROOT + 'login.html'; a.setAttribute('aria-label', 'Login or sign up'); if (label) label.textContent = 'Login'; }
  });
}

// ---------- wishlist sync ----------
let currentUser = null;
async function syncWishlist(user, profile) {
  const cloud = (profile && Array.isArray(profile.wishlist)) ? profile.wishlist : [];
  const merged = Array.from(new Set([...cloud, ...localWish()]));
  setLocalWish(merged);
  if (merged.length !== cloud.length) await updateDoc(doc(db, 'customers', user.uid), { wishlist: merged, updatedAt: serverTimestamp() }).catch(() => {});
  document.dispatchEvent(new CustomEvent('wishlist-refresh'));
}
document.addEventListener('wishlist-change', (e) => {
  if (!currentUser) return;
  updateDoc(doc(db, 'customers', currentUser.uid), { wishlist: e.detail, updatedAt: serverTimestamp() }).catch(() => {});
});

async function loadProfile(user) {
  const snap = await getDoc(doc(db, 'customers', user.uid));
  if (snap.exists()) return snap.data();
  const p = { name: user.displayName || '', email: user.email, phone: '', city: '', birthday: '', marketingOptIn: false, wishlist: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  await setDoc(doc(db, 'customers', user.uid), p);
  return p;
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  let profile = null;
  if (user) { try { profile = await loadProfile(user); await syncWishlist(user, profile); } catch (e) { console.warn(e); } }
  paintHeader(user, profile);
  if ((page === 'login' || page === 'signup') && user && !window.__justSignedUp) location.replace(next());
  if (page === 'account') { if (!user) location.replace(ROOT + 'login.html?next=account.html'); else renderAccount(user, profile); }
});

// ---------- signup ----------
const sf = $('#signup-form');
if (sf) sf.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(sf), out = $('.form-msg', sf), btn = $('button[type=submit]', sf);
  const name = (f.get('name') || '').trim(), email = (f.get('email') || '').trim(), pw = f.get('password') || '';
  if (name.length < 2) return show(out, 'Please enter your name.');
  if (pw.length < 8) return show(out, 'Please choose a password with at least 8 characters.');
  if (pw !== f.get('password2')) return show(out, 'The two passwords do not match.');
  if (!f.get('terms')) return show(out, 'Please accept the Privacy Policy and Terms to continue.');
  busy(btn, true, 'Create account');
  try {
    window.__justSignedUp = true;
    const cred = await createUserWithEmailAndPassword(auth, email, pw);
    await updateProfile(cred.user, { displayName: name });
    await setDoc(doc(db, 'customers', cred.user.uid), {
      name, email, phone: (f.get('phone') || '').trim(), city: (f.get('city') || '').trim(), birthday: f.get('birthday') || '',
      marketingOptIn: !!f.get('marketing'), consentAt: serverTimestamp(), wishlist: localWish(),
      source: 'website', createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    sendEmailVerification(cred.user).catch(() => {});
    show(out, 'Welcome to the Grainley Family! Taking you to your account…', true);
    setTimeout(() => location.replace(next()), 1200);
  } catch (err) { window.__justSignedUp = false; show(out, msg(err)); busy(btn, false, 'Create account'); }
});

// ---------- login ----------
const lf = $('#login-form');
if (lf) lf.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(lf), out = $('.form-msg', lf), btn = $('button[type=submit]', lf);
  busy(btn, true, 'Login');
  try { await signInWithEmailAndPassword(auth, (f.get('email') || '').trim(), f.get('password') || ''); location.replace(next()); }
  catch (err) { show(out, msg(err)); busy(btn, false, 'Login'); }
});
const fp = $('#forgot');
if (fp) fp.addEventListener('click', async (e) => {
  e.preventDefault();
  const email = ($('#login-form [name=email]').value || '').trim(), out = $('#login-form .form-msg');
  if (!email) return show(out, 'Type your email above, then tap “Forgot password?” again.');
  try { await sendPasswordResetEmail(auth, email); show(out, 'If an account exists for ' + email + ', a reset link is on its way. Check your inbox and spam folder.', true); }
  catch (err) { show(out, msg(err)); }
});

// ---------- account page ----------
function renderAccount(user, p) {
  p = p || {};
  $('#acct-name').textContent = (p.name || user.displayName || 'there').split(' ')[0];
  $('#acct-email').textContent = user.email;
  const v = $('#verify-note');
  if (v) v.hidden = user.emailVerified;
  const pf = $('#profile-form');
  ['name', 'phone', 'city', 'birthday'].forEach((k) => { if (pf.elements[k]) pf.elements[k].value = p[k] || ''; });
  pf.elements.marketing.checked = !!p.marketingOptIn;
  const wc = $('#acct-wish-count'); if (wc) wc.textContent = localWish().length;
  $('#acct-loading').hidden = true; $('#acct-body').hidden = false;
}
const pf = $('#profile-form');
if (pf) pf.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return;
  const f = new FormData(pf), out = $('.form-msg', pf), btn = $('button[type=submit]', pf);
  busy(btn, true, 'Save changes');
  try {
    const name = (f.get('name') || '').trim();
    await updateDoc(doc(db, 'customers', currentUser.uid), { name, phone: (f.get('phone') || '').trim(), city: (f.get('city') || '').trim(), birthday: f.get('birthday') || '', marketingOptIn: !!f.get('marketing'), updatedAt: serverTimestamp() });
    if (name) await updateProfile(currentUser, { displayName: name });
    show(out, 'Saved.', true); paintHeader(currentUser, { name });
  } catch (err) { show(out, msg(err)); }
  busy(btn, false, 'Save changes');
});
const rv = $('#resend-verify');
if (rv) rv.addEventListener('click', async (e) => { e.preventDefault(); if (currentUser) { await sendEmailVerification(currentUser).catch(() => {}); rv.textContent = 'Sent. Check your inbox.'; } });
const lo = $('#logout');
if (lo) lo.addEventListener('click', async () => { await signOut(auth); setLocalWish([]); location.replace(ROOT + 'index.html'); });
const del = $('#delete-account');
if (del) del.addEventListener('click', async () => {
  const out = $('#delete-msg');
  const pw = window.prompt('To delete your account and all saved details, type your password:');
  if (!pw || !currentUser) return;
  try {
    await reauthenticateWithCredential(currentUser, EmailAuthProvider.credential(currentUser.email, pw));
    await deleteDoc(doc(db, 'customers', currentUser.uid));
    await deleteUser(currentUser);
    setLocalWish([]);
    location.replace(ROOT + 'index.html');
  } catch (err) { show(out, msg(err)); }
});
