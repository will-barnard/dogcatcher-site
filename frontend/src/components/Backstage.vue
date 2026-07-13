<template>
  <div class="backstage-shell">
    <!-- ===================== NOT LOGGED IN ===================== -->
    <div v-if="!me">
      <div class="login-box">
        <h1>{{ setupComplete ? 'Backstage' : 'First Run' }}</h1>
        <p class="hint" v-if="!setupComplete">
          No account exists yet. The first account you create becomes the site
          administrator.
        </p>
        <p class="hint" v-else>Staff only. Please sign in.</p>

        <div v-if="error" class="err">{{ error }}</div>

        <form @submit.prevent="setupComplete ? doLogin() : doFirstRun()">
          <label class="field">Username</label>
          <input type="text" v-model.trim="form.username" autocomplete="username" />
          <label class="field">Password</label>
          <input type="password" v-model="form.password" autocomplete="current-password" />
          <div style="margin-top:18px" class="row">
            <button type="submit" :disabled="busy">
              {{ setupComplete ? 'Sign in' : 'Create administrator' }}
            </button>
            <router-link to="/" class="btn ghost shrink" style="text-align:center">← site</router-link>
          </div>
        </form>
      </div>
    </div>

    <!-- ===================== LOGGED IN ===================== -->
    <div v-else>
      <div class="backstage-bar">
        <span class="title">Dogcatcher · Backstage</span>
        <span>
          <span class="hint" style="color:#cdbf9a">{{ me.username }} ({{ me.role }})</span>
          &nbsp;
          <router-link to="/" class="btn ghost shrink" style="color:#f2ebd8">view site</router-link>
          <button class="ghost" style="color:#f2ebd8" @click="doLogout">log out</button>
        </span>
      </div>

      <div class="backstage-body">
        <div v-if="notice" class="ok">{{ notice }}</div>
        <div v-if="error" class="err">{{ error }}</div>

        <div class="admin-tabs">
          <button :class="{ active: tab==='text' }" @click="tab='text'">Page Text</button>
          <button :class="{ active: tab==='journal' }" @click="tab='journal'">Journal</button>
          <button :class="{ active: tab==='shows' }" @click="tab='shows'">Shows</button>
          <button :class="{ active: tab==='photos' }" @click="tab='photos'">Photos</button>
          <button v-if="me.role==='admin'" :class="{ active: tab==='users' }" @click="tab='users'">Accounts</button>
        </div>

        <!-- ---------- PAGE TEXT ---------- -->
        <div v-show="tab==='text'" class="admin-section">
          <h2>Editable page text</h2>
          <div v-for="f in textFields" :key="f.key" style="margin-bottom:16px">
            <label class="field">{{ f.label }}</label>
            <textarea v-model="content[f.key]" :style="f.short ? 'min-height:60px' : ''"></textarea>
          </div>
          <button @click="saveContent" :disabled="busy">Save page text</button>
        </div>

        <!-- ---------- JOURNAL ---------- -->
        <div v-show="tab==='journal'" class="admin-section">
          <h2>Journal posts</h2>
          <div class="list-item" style="background:#f0ead6">
            <label class="field">New entry — title</label>
            <input type="text" v-model="newPost.title" placeholder="a title, or leave blank" />
            <label class="field">Body</label>
            <textarea v-model="newPost.body" placeholder="write something…"></textarea>
            <div style="margin-top:10px"><button @click="addPost" :disabled="busy">Post entry</button></div>
          </div>

          <div v-for="p in posts" :key="p.id" class="list-item">
            <label class="field">Title</label>
            <input type="text" v-model="p.title" />
            <label class="field">Body</label>
            <textarea v-model="p.body"></textarea>
            <div class="row" style="margin-top:10px">
              <span class="hint shrink">{{ formatDate(p.published_at) }}</span>
              <span></span>
              <button class="shrink" @click="savePost(p)" :disabled="busy">Save</button>
              <button class="shrink danger" @click="deletePost(p)" :disabled="busy">Delete</button>
            </div>
          </div>
        </div>

        <!-- ---------- SHOWS ---------- -->
        <div v-show="tab==='shows'" class="admin-section">
          <h2>Shows</h2>
          <div class="list-item" style="background:#f0ead6">
            <div class="row">
              <div><label class="field">Date (free text)</label><input type="text" v-model="newShow.show_date" placeholder="Aug 14 / TBA" /></div>
              <div><label class="field">Sort key</label><input type="text" v-model="newShow.sort_key" placeholder="2026-08-14" /></div>
            </div>
            <div class="row">
              <div><label class="field">Venue</label><input type="text" v-model="newShow.venue" /></div>
              <div><label class="field">City</label><input type="text" v-model="newShow.city" /></div>
            </div>
            <label class="field">Ticket URL</label>
            <input type="url" v-model="newShow.ticket_url" placeholder="https://…" />
            <div style="margin-top:10px"><button @click="addShow" :disabled="busy">Add show</button></div>
            <div class="hint">Shows sort by “sort key” ascending — use a date like 2026-08-14 to keep them in order.</div>
          </div>

          <div v-for="s in shows" :key="s.id" class="list-item">
            <div class="row">
              <div><label class="field">Date</label><input type="text" v-model="s.show_date" /></div>
              <div><label class="field">Sort key</label><input type="text" v-model="s.sort_key" /></div>
            </div>
            <div class="row">
              <div><label class="field">Venue</label><input type="text" v-model="s.venue" /></div>
              <div><label class="field">City</label><input type="text" v-model="s.city" /></div>
            </div>
            <label class="field">Ticket URL</label>
            <input type="url" v-model="s.ticket_url" />
            <div class="row" style="margin-top:10px">
              <span></span>
              <button class="shrink" @click="saveShow(s)" :disabled="busy">Save</button>
              <button class="shrink danger" @click="deleteShow(s)" :disabled="busy">Delete</button>
            </div>
          </div>
        </div>

        <!-- ---------- PHOTOS ---------- -->
        <div v-show="tab==='photos'" class="admin-section">
          <h2>Photos</h2>
          <div class="list-item" style="background:#f0ead6">
            <label class="field">Upload an image</label>
            <input type="file" accept="image/*" ref="fileInput" @change="onFile" />
            <label class="field">Caption</label>
            <input type="text" v-model="newPhoto.caption" placeholder="optional caption" />
            <div style="margin-top:10px"><button @click="uploadPhoto" :disabled="busy || !newPhoto.file">Upload photo</button></div>
          </div>

          <div v-for="ph in photos" :key="ph.id" class="list-item">
            <div class="thumb-row">
              <img :src="`/api/photos/${ph.id}/raw`" :alt="ph.caption" />
              <div style="flex:1">
                <label class="field">Caption</label>
                <input type="text" v-model="ph.caption" />
                <label class="field">Order</label>
                <input type="text" v-model="ph.sort_key" style="max-width:120px" />
                <div class="row" style="margin-top:10px">
                  <span></span>
                  <button class="shrink" @click="savePhoto(ph)" :disabled="busy">Save</button>
                  <button class="shrink danger" @click="deletePhoto(ph)" :disabled="busy">Delete</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ---------- ACCOUNTS (admin only) ---------- -->
        <div v-show="tab==='users'" v-if="me.role==='admin'" class="admin-section">
          <h2>Accounts</h2>
          <div class="list-item" style="background:#f0ead6">
            <p class="hint">Create an account for a bandmate. Editors can change all site content; admins can also manage accounts.</p>
            <div class="row">
              <div><label class="field">Username</label><input type="text" v-model="newUser.username" /></div>
              <div><label class="field">Password</label><input type="text" v-model="newUser.password" placeholder="6+ characters" /></div>
              <div class="shrink"><label class="field">Role</label>
                <select v-model="newUser.role"><option value="editor">editor</option><option value="admin">admin</option></select>
              </div>
            </div>
            <div style="margin-top:10px"><button @click="addUser" :disabled="busy">Create account</button></div>
          </div>

          <table class="shows" style="background:#fbf7ea">
            <thead><tr><th>User</th><th>Role</th><th>Since</th><th></th></tr></thead>
            <tbody>
              <tr v-for="u in users" :key="u.id">
                <td>{{ u.username }}</td>
                <td>{{ u.role }}</td>
                <td class="hint">{{ formatDate(u.created_at) }}</td>
                <td>
                  <button v-if="u.id !== me.id" class="danger shrink" @click="deleteUser(u)" :disabled="busy">remove</button>
                  <span v-else class="hint">you</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { api, setToken } from '../api.js';

const setupComplete = ref(true);
const me = ref(null);
const busy = ref(false);
const error = ref('');
const notice = ref('');
const tab = ref('text');

const form = reactive({ username: '', password: '' });

const content = reactive({});
const textFields = [
  { key: 'hero_tagline', label: 'Header tagline (under the logo)', short: true },
  { key: 'about_body', label: 'Home / about text' },
  { key: 'journal_intro', label: 'Journal intro line', short: true },
  { key: 'shows_intro', label: 'Shows intro line', short: true },
  { key: 'footer_text', label: 'Footer text', short: true },
];

const posts = ref([]);
const newPost = reactive({ title: '', body: '' });
const shows = ref([]);
const newShow = reactive({ show_date: '', venue: '', city: '', ticket_url: '', sort_key: '' });
const photos = ref([]);
const newPhoto = reactive({ file: null, caption: '' });
const fileInput = ref(null);
const users = ref([]);
const newUser = reactive({ username: '', password: '', role: 'editor' });

function flash(msg) { notice.value = msg; setTimeout(() => (notice.value = ''), 2500); }
function fail(e) { error.value = e.message || String(e); setTimeout(() => (error.value = ''), 5000); }
function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

async function refreshStatus() {
  try {
    const s = await api.get('/auth/status');
    setupComplete.value = s.setupComplete;
  } catch (e) { /* ignore */ }
}

async function loadAll() {
  const [c, p, sh, ph] = await Promise.all([
    api.get('/content'), api.get('/posts'), api.get('/shows'), api.get('/photos'),
  ]);
  Object.assign(content, c);
  posts.value = p; shows.value = sh; photos.value = ph;
  if (me.value && me.value.role === 'admin') users.value = await api.get('/users');
}

async function doFirstRun() {
  error.value = ''; busy.value = true;
  try {
    const r = await api.post('/auth/register', { username: form.username, password: form.password });
    if (r.token) setToken(r.token);
    me.value = r.user;
    await loadAll();
    flash('Administrator account created. Welcome backstage.');
  } catch (e) { fail(e); } finally { busy.value = false; }
}

async function doLogin() {
  error.value = ''; busy.value = true;
  try {
    const r = await api.post('/auth/login', { username: form.username, password: form.password });
    if (r.token) setToken(r.token);
    me.value = r.user;
    await loadAll();
  } catch (e) { fail(e); } finally { busy.value = false; }
}

async function doLogout() {
  try { await api.post('/auth/logout'); } catch {}
  setToken(null); me.value = null; form.username = ''; form.password = '';
}

// ---- content ----
async function saveContent() {
  busy.value = true;
  try {
    for (const f of textFields) {
      await api.put('/content/' + f.key, { value: content[f.key] || '' });
    }
    flash('Page text saved.');
  } catch (e) { fail(e); } finally { busy.value = false; }
}

// ---- posts ----
async function addPost() {
  busy.value = true;
  try {
    const p = await api.post('/posts', { title: newPost.title, body: newPost.body });
    posts.value.unshift(p); newPost.title = ''; newPost.body = ''; flash('Entry posted.');
  } catch (e) { fail(e); } finally { busy.value = false; }
}
async function savePost(p) {
  busy.value = true;
  try { await api.put('/posts/' + p.id, { title: p.title, body: p.body }); flash('Saved.'); }
  catch (e) { fail(e); } finally { busy.value = false; }
}
async function deletePost(p) {
  if (!confirm('Delete this entry?')) return;
  busy.value = true;
  try { await api.del('/posts/' + p.id); posts.value = posts.value.filter(x => x.id !== p.id); flash('Deleted.'); }
  catch (e) { fail(e); } finally { busy.value = false; }
}

// ---- shows ----
async function addShow() {
  busy.value = true;
  try {
    const s = await api.post('/shows', { ...newShow });
    shows.value.push(s);
    Object.assign(newShow, { show_date: '', venue: '', city: '', ticket_url: '', sort_key: '' });
    flash('Show added.');
  } catch (e) { fail(e); } finally { busy.value = false; }
}
async function saveShow(s) {
  busy.value = true;
  try { await api.put('/shows/' + s.id, { ...s }); flash('Saved.'); }
  catch (e) { fail(e); } finally { busy.value = false; }
}
async function deleteShow(s) {
  if (!confirm('Delete this show?')) return;
  busy.value = true;
  try { await api.del('/shows/' + s.id); shows.value = shows.value.filter(x => x.id !== s.id); flash('Deleted.'); }
  catch (e) { fail(e); } finally { busy.value = false; }
}

// ---- photos ----
function onFile(e) { newPhoto.file = e.target.files[0] || null; }
async function uploadPhoto() {
  if (!newPhoto.file) return;
  busy.value = true;
  try {
    const fd = new FormData();
    fd.append('image', newPhoto.file);
    fd.append('caption', newPhoto.caption || '');
    const ph = await api.upload('/photos', fd);
    photos.value.push(ph);
    newPhoto.file = null; newPhoto.caption = '';
    if (fileInput.value) fileInput.value.value = '';
    flash('Photo uploaded.');
  } catch (e) { fail(e); } finally { busy.value = false; }
}
async function savePhoto(ph) {
  busy.value = true;
  try { await api.put('/photos/' + ph.id, { caption: ph.caption, sort_key: parseInt(ph.sort_key) || 0 }); flash('Saved.'); }
  catch (e) { fail(e); } finally { busy.value = false; }
}
async function deletePhoto(ph) {
  if (!confirm('Delete this photo?')) return;
  busy.value = true;
  try { await api.del('/photos/' + ph.id); photos.value = photos.value.filter(x => x.id !== ph.id); flash('Deleted.'); }
  catch (e) { fail(e); } finally { busy.value = false; }
}

// ---- users ----
async function addUser() {
  busy.value = true;
  try {
    await api.post('/auth/register', { username: newUser.username, password: newUser.password, role: newUser.role });
    Object.assign(newUser, { username: '', password: '', role: 'editor' });
    users.value = await api.get('/users');
    flash('Account created.');
  } catch (e) { fail(e); } finally { busy.value = false; }
}
async function deleteUser(u) {
  if (!confirm('Remove account “' + u.username + '”?')) return;
  busy.value = true;
  try { await api.del('/users/' + u.id); users.value = users.value.filter(x => x.id !== u.id); flash('Removed.'); }
  catch (e) { fail(e); } finally { busy.value = false; }
}

onMounted(async () => {
  await refreshStatus();
  try {
    const r = await api.get('/auth/me');
    me.value = r.user;
    await loadAll();
  } catch {
    // not logged in — show login/first-run form
  }
});
</script>
