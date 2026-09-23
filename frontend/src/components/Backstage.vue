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
    <!-- This mirrors PublicSite.vue's markup (.wrap / .masthead / .section
         etc.) on purpose, using the same classes, so editing here looks
         like the real page. EditableField swaps text for an input/textarea
         on click; ghost-add rows/tiles create a blank row you then click
         into; delete buttons sit in the corner of each item. -->
    <div v-else>
      <div class="backstage-bar">
        <span class="title">Dogcatcher · Backstage</span>
        <span>
          <span class="hint" style="color:#c7c2a3">{{ me.username }} ({{ me.role }})</span>
          &nbsp;
          <router-link to="/" class="btn ghost shrink" style="color:#f4efdc">view site</router-link>
          <button class="ghost" style="color:#f4efdc" @click="doLogout">log out</button>
        </span>
      </div>

      <div v-if="notice" class="ok" style="margin:14px 26px 0">{{ notice }}</div>
      <div v-if="error" class="err" style="margin:14px 26px 0">{{ error }}</div>

      <div class="wrap">
        <!-- MASTHEAD -->
        <header class="masthead">
          <div class="editable-logo" @click="logoFileInput && logoFileInput.click()">
            <img class="logo" :src="logoPreviewSrc" :width="logoMeta.width || 5000" :height="logoMeta.height || 3000" alt="Dogcatcher" />
            <span class="logo-edit-mark">✎ click to change logo</span>
          </div>
          <input type="file" accept="image/*" ref="logoFileInput" style="display:none" @change="onLogoFile" />
          <div v-if="logoMeta.exists" style="text-align:center;margin-top:6px">
            <button class="ghost shrink" @click="resetLogo" :disabled="busy">reset to default logo</button>
          </div>
          <EditableField
            v-model="content.hero_tagline"
            tag="div"
            class="tagline"
            placeholder="(click to add a tagline)"
            :on-save="v => saveField('hero_tagline', v)"
            @error="fail"
            style="text-align:center"
          />
        </header>

        <main class="paper-pad">
          <!-- ABOUT -->
          <section id="about" class="section">
            <h2 class="section-head">
              <EditableField
                v-model="content.about_title"
                placeholder="welcome in"
                :on-save="v => saveField('about_title', v)"
                @error="fail"
              />
              <span class="marker">✦</span>
            </h2>
            <EditableField
              v-model="content.about_body"
              block
              tag="div"
              class="panel prose"
              placeholder="(click to write the home / about text)"
              :on-save="v => saveField('about_body', v)"
              @error="fail"
            />
          </section>

          <!-- JOURNAL -->
          <section id="journal" class="section">
            <h2 class="section-head">
              <EditableField
                v-model="content.journal_title"
                placeholder="the journal"
                :on-save="v => saveField('journal_title', v)"
                @error="fail"
              />
              <span class="marker">✎</span>
            </h2>
            <EditableField
              v-model="content.journal_intro"
              tag="div"
              class="muted"
              placeholder="(click to add an intro line)"
              :on-save="v => saveField('journal_intro', v)"
              @error="fail"
            />

            <article v-for="p in posts" :key="p.id" class="entry editable-entry">
              <button class="danger shrink entry-delete" @click="deletePost(p)" :disabled="busy">delete</button>
              <div class="date">{{ formatDate(p.published_at) }}</div>
              <EditableField
                v-model="p.title"
                tag="h3"
                placeholder="(untitled — click to add one)"
                :on-save="v => savePostField(p, 'title', v)"
                @error="fail"
              />
              <EditableField
                v-model="p.body"
                block
                tag="div"
                class="body"
                placeholder="(click to write this entry)"
                :on-save="v => savePostField(p, 'body', v)"
                @error="fail"
              />
              <hr />
            </article>

            <div class="ghost-add" @click="addPost" :class="{ disabled: busy }">+ new journal entry</div>
          </section>

          <!-- SHOWS -->
          <section id="shows" class="section">
            <h2 class="section-head">
              <EditableField
                v-model="content.shows_title"
                placeholder="shows"
                :on-save="v => saveField('shows_title', v)"
                @error="fail"
              />
              <span class="marker">☞</span>
            </h2>
            <EditableField
              v-model="content.shows_intro"
              tag="div"
              class="muted"
              placeholder="(click to add an intro line)"
              :on-save="v => saveField('shows_intro', v)"
              @error="fail"
            />

            <table class="shows">
              <thead>
                <tr><th>Date</th><th>Venue</th><th>City</th><th>Tickets</th><th></th></tr>
              </thead>
              <tbody>
                <tr v-for="s in shows" :key="s.id">
                  <td>
                    <EditableField v-model="s.show_date" placeholder="date" :on-save="v => saveShowField(s, 'show_date', v)" @error="fail" />
                    <div class="hint" style="margin-top:4px;white-space:nowrap">
                      sort key:
                      <EditableField v-model="s.sort_key" placeholder="2026-08-14" :on-save="v => saveShowField(s, 'sort_key', v)" @error="fail" />
                    </div>
                  </td>
                  <td><EditableField v-model="s.venue" placeholder="venue" :on-save="v => saveShowField(s, 'venue', v)" @error="fail" /></td>
                  <td><EditableField v-model="s.city" placeholder="city" :on-save="v => saveShowField(s, 'city', v)" @error="fail" /></td>
                  <td><EditableField v-model="s.ticket_url" type="url" placeholder="ticket link" :on-save="v => saveShowField(s, 'ticket_url', v)" @error="fail" /></td>
                  <td><button class="danger shrink" @click="deleteShow(s)" :disabled="busy">delete</button></td>
                </tr>
              </tbody>
            </table>
            <div class="ghost-add" @click="addShow" :class="{ disabled: busy }">+ add a show</div>
            <div class="hint" style="margin-top:6px">Shows sort by "sort key" ascending — use a date like 2026-08-14 to keep them in order, and it's what marks a show as past.</div>
          </section>

          <!-- GALLERY -->
          <section id="gallery" class="section">
            <h2 class="section-head">
              <EditableField
                v-model="content.gallery_title"
                placeholder="photos"
                :on-save="v => saveField('gallery_title', v)"
                @error="fail"
              />
              <span class="marker">❂</span>
            </h2>
            <div class="gallery">
              <figure
                v-for="ph in photos"
                :key="ph.id"
                class="editable-photo"
                :class="{ dragging: draggingPhotoId === ph.id, 'drag-over': dragOverPhotoId === ph.id }"
                draggable="true"
                @dragstart="onPhotoDragStart(ph, $event)"
                @dragover.prevent="onPhotoDragOver(ph)"
                @dragleave="onPhotoDragLeave(ph)"
                @drop.prevent="onPhotoDrop(ph)"
                @dragend="onPhotoDragEnd"
              >
                <button class="danger shrink photo-delete" @click="deletePhoto(ph)" :disabled="busy" title="Delete photo">×</button>
                <img :src="`/api/photos/${ph.id}/raw`" :alt="ph.caption" draggable="false" />
                <EditableField
                  v-model="ph.caption"
                  tag="figcaption"
                  placeholder="(click to add a caption)"
                  :on-save="v => savePhotoField(ph, v)"
                  @error="fail"
                />
              </figure>
              <div
                class="gallery-add"
                :class="{ disabled: busy, 'drag-over': dragOverPhotoId === 'add' }"
                @click="photoFileInput && photoFileInput.click()"
                @dragover.prevent="dragOverPhotoId = 'add'"
                @dragleave="dragOverPhotoId = null"
                @drop.prevent="onGalleryAddDrop"
              >+ add photo</div>
              <input type="file" accept="image/*" ref="photoFileInput" style="display:none" @change="onGalleryFile" />
            </div>
            <p class="hint" style="margin-top:6px">Drag photos to reorder them.</p>
          </section>

          <!-- FOOTER -->
          <footer class="footer">
            <EditableField
              v-model="content.footer_text"
              tag="div"
              placeholder="(click to add footer text)"
              :on-save="v => saveField('footer_text', v)"
              @error="fail"
            />
          </footer>
        </main>
      </div>

      <!-- ACCOUNTS — admin only, no public-site equivalent, so it stays a
           plain panel rather than pretending to be part of the page. -->
      <div v-if="me.role==='admin'" class="backstage-body" style="padding-top:0">
        <div class="admin-section">
          <h2>Accounts <span class="hint" style="text-transform:none;letter-spacing:0">— not shown on the public site</span></h2>
          <p class="hint">Create an account for a bandmate. Editors can change all site content; admins can also manage accounts.</p>
          <div class="list-item" style="background:#32532f">
            <div class="row">
              <div><label class="field">Username</label><input type="text" v-model="newUser.username" /></div>
              <div><label class="field">Password</label><input type="text" v-model="newUser.password" placeholder="6+ characters" /></div>
              <div class="shrink"><label class="field">Role</label>
                <select v-model="newUser.role"><option value="editor">editor</option><option value="admin">admin</option></select>
              </div>
            </div>
            <div style="margin-top:10px"><button @click="addUser" :disabled="busy">Create account</button></div>
          </div>

          <table class="shows" style="background:#142418">
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
import { ref, reactive, computed, onMounted } from 'vue';
import { api, setToken } from '../api.js';
import EditableField from './EditableField.vue';

const setupComplete = ref(true);
const me = ref(null);
const busy = ref(false);
const error = ref('');
const notice = ref('');

const form = reactive({ username: '', password: '' });

const content = reactive({});
const posts = ref([]);
const shows = ref([]);
const photos = ref([]);
const photoFileInput = ref(null);
const logoMeta = ref({ exists: false });
const logoFileInput = ref(null);
const logoPreviewSrc = computed(() =>
  logoMeta.value.exists ? `/api/assets/logo/raw?v=${encodeURIComponent(logoMeta.value.updated_at || '')}` : '/logo.png'
);
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
  const [c, p, sh, ph, lm] = await Promise.all([
    api.get('/content'), api.get('/posts'), api.get('/shows'), api.get('/photos'), api.get('/assets/logo/meta'),
  ]);
  Object.assign(content, c);
  posts.value = p; shows.value = sh; photos.value = ph; logoMeta.value = lm;
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

// ---- page text (each field saves itself the moment you click Save on it) ----
async function saveField(key, value) {
  await api.put('/content/' + key, { value });
}

// ---- posts ----
async function addPost() {
  if (busy.value) return;
  busy.value = true;
  try {
    const p = await api.post('/posts', { title: '', body: '' });
    posts.value.unshift(p);
    flash('New entry added — click it to write something.');
  } catch (e) { fail(e); } finally { busy.value = false; }
}
async function savePostField(p, field, value) {
  const payload = { title: p.title, body: p.body };
  payload[field] = value;
  const updated = await api.put('/posts/' + p.id, payload);
  Object.assign(p, updated);
}
async function deletePost(p) {
  if (!confirm('Delete this entry?')) return;
  busy.value = true;
  try { await api.del('/posts/' + p.id); posts.value = posts.value.filter(x => x.id !== p.id); flash('Deleted.'); }
  catch (e) { fail(e); } finally { busy.value = false; }
}

// ---- shows ----
async function addShow() {
  if (busy.value) return;
  busy.value = true;
  try {
    const s = await api.post('/shows', { show_date: '', venue: '', city: '', ticket_url: '', sort_key: '' });
    shows.value.push(s);
    flash('Show added — click its cells to fill it in.');
  } catch (e) { fail(e); } finally { busy.value = false; }
}
async function saveShowField(s, field, value) {
  const payload = { show_date: s.show_date, venue: s.venue, city: s.city, ticket_url: s.ticket_url, sort_key: s.sort_key };
  payload[field] = value;
  const updated = await api.put('/shows/' + s.id, payload);
  Object.assign(s, updated);
}
async function deleteShow(s) {
  if (!confirm('Delete this show?')) return;
  busy.value = true;
  try { await api.del('/shows/' + s.id); shows.value = shows.value.filter(x => x.id !== s.id); flash('Deleted.'); }
  catch (e) { fail(e); } finally { busy.value = false; }
}

// ---- photos ----
// Clicking the "+ add photo" tile opens the file picker; picking a file
// uploads it right away with an empty caption, so the new tile appears
// immediately and the caption is just another click-to-edit field.
async function onGalleryFile(e) {
  const file = e.target.files[0] || null;
  if (!file) return;
  busy.value = true;
  try {
    const fd = new FormData();
    fd.append('image', file);
    fd.append('caption', '');
    const ph = await api.upload('/photos', fd);
    photos.value.push(ph);
    flash('Photo added — click its caption to describe it.');
  } catch (e) { fail(e); } finally {
    busy.value = false;
    if (photoFileInput.value) photoFileInput.value.value = '';
  }
}
async function savePhotoField(ph, value) {
  const updated = await api.put('/photos/' + ph.id, { caption: value, sort_key: ph.sort_key });
  Object.assign(ph, updated);
}

// Native HTML5 drag-and-drop -- no library, matches how the rest of this
// app is built. Dragging just reorders the local array; the drop handler
// then writes fresh sequential sort_keys back for whichever photos moved.
const draggingPhotoId = ref(null);
const dragOverPhotoId = ref(null);

function onPhotoDragStart(ph, e) {
  if (busy.value) { e.preventDefault(); return; }
  draggingPhotoId.value = ph.id;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    // Firefox refuses to start a drag without data actually being set.
    e.dataTransfer.setData('text/plain', String(ph.id));
  }
}
function onPhotoDragOver(ph) {
  if (draggingPhotoId.value === null || draggingPhotoId.value === ph.id) return;
  dragOverPhotoId.value = ph.id;
}
function onPhotoDragLeave(ph) {
  if (dragOverPhotoId.value === ph.id) dragOverPhotoId.value = null;
}
function onPhotoDragEnd() {
  draggingPhotoId.value = null;
  dragOverPhotoId.value = null;
}
async function onPhotoDrop(ph) {
  const fromId = draggingPhotoId.value;
  draggingPhotoId.value = null;
  dragOverPhotoId.value = null;
  if (fromId === null || fromId === ph.id) return;
  const fromIdx = photos.value.findIndex(x => x.id === fromId);
  const toIdx = photos.value.findIndex(x => x.id === ph.id);
  if (fromIdx === -1 || toIdx === -1) return;
  const [moved] = photos.value.splice(fromIdx, 1);
  photos.value.splice(toIdx, 0, moved);
  await persistPhotoOrder();
}
async function onGalleryAddDrop() {
  const fromId = draggingPhotoId.value;
  draggingPhotoId.value = null;
  dragOverPhotoId.value = null;
  if (fromId === null) return;
  const fromIdx = photos.value.findIndex(x => x.id === fromId);
  if (fromIdx === -1) return;
  const [moved] = photos.value.splice(fromIdx, 1);
  photos.value.push(moved);
  await persistPhotoOrder();
}
async function persistPhotoOrder() {
  busy.value = true;
  try {
    for (let i = 0; i < photos.value.length; i++) {
      const ph = photos.value[i];
      if (ph.sort_key === i) continue;
      const updated = await api.put('/photos/' + ph.id, { caption: ph.caption, sort_key: i });
      Object.assign(ph, updated);
    }
    flash('Photo order saved.');
  } catch (e) { fail(e); } finally { busy.value = false; }
}
async function deletePhoto(ph) {
  if (!confirm('Delete this photo?')) return;
  busy.value = true;
  try { await api.del('/photos/' + ph.id); photos.value = photos.value.filter(x => x.id !== ph.id); flash('Deleted.'); }
  catch (e) { fail(e); } finally { busy.value = false; }
}

// ---- logo ----
// Read the image's real pixel size in the browser before it ever reaches
// the server, so the public page can set <img width height> and reserve
// the right box on first paint -- that's the whole fix for the load-in
// snap, no animation involved. Clicking the logo itself opens the file
// picker and uploads immediately, same one-click pattern as photos.
function readImageSize(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve({ width: null, height: null }); URL.revokeObjectURL(url); };
    img.src = url;
  });
}
async function onLogoFile(e) {
  const file = e.target.files[0] || null;
  if (!file) return;
  busy.value = true;
  try {
    const dims = await readImageSize(file);
    const fd = new FormData();
    fd.append('image', file);
    if (dims.width) fd.append('width', dims.width);
    if (dims.height) fd.append('height', dims.height);
    logoMeta.value = await api.upload('/assets/logo', fd);
    flash('Logo updated.');
  } catch (e) { fail(e); } finally {
    busy.value = false;
    if (logoFileInput.value) logoFileInput.value.value = '';
  }
}
async function resetLogo() {
  if (!confirm('Remove the uploaded logo and go back to the default?')) return;
  busy.value = true;
  try { await api.del('/assets/logo'); logoMeta.value = { exists: false }; flash('Logo reset to default.'); }
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
