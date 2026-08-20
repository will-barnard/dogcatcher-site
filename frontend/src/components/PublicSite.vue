<template>
  <div class="wrap">
    <!-- MASTHEAD -->
    <header class="masthead">
      <img class="logo" src="/logo.png" alt="Dogcatcher" />
      <p v-if="content.hero_tagline" class="tagline">{{ content.hero_tagline }}</p>
    </header>

    <!-- NAV (anchors — it's all one page) -->
    <nav class="topnav">
      <a href="#about">home</a>
      <a href="#journal">journal</a>
      <a href="#shows">shows</a>
      <a href="#gallery">photos</a>
    </nav>

    <main class="paper-pad">
      <!-- ABOUT / HOME -->
      <section id="about" class="section">
        <h2 class="section-head"><span>welcome in</span><span class="marker">✦</span></h2>
        <div v-if="content.about_body" class="panel prose">{{ content.about_body }}</div>
      </section>

      <!-- JOURNAL -->
      <section id="journal" class="section">
        <h2 class="section-head"><span>the journal</span><span class="marker">✎</span></h2>
        <p v-if="content.journal_intro" class="muted">{{ content.journal_intro }}</p>
        <div v-if="posts.length === 0" class="panel muted">Nothing written down yet. Check back.</div>
        <article v-for="p in posts" :key="p.id" class="entry">
          <div class="date">{{ formatDate(p.published_at) }}</div>
          <h3 v-if="p.title">{{ p.title }}</h3>
          <div class="body">{{ p.body }}</div>
          <hr />
        </article>
      </section>

      <!-- SHOWS -->
      <section id="shows" class="section">
        <h2 class="section-head"><span>shows</span><span class="marker">☞</span></h2>
        <p v-if="content.shows_intro" class="muted">{{ content.shows_intro }}</p>
        <div v-if="shows.length === 0" class="panel muted">No dates on the books. Soon.</div>
        <table v-else class="shows">
          <thead>
            <tr><th>Date</th><th>Venue</th><th>City</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="s in shows" :key="s.id" :class="{ past: isPast(s) }">
              <td class="date">{{ s.show_date }}</td>
              <td>{{ s.venue }}</td>
              <td>{{ s.city }}</td>
              <td>
                <a v-if="s.ticket_url" :href="s.ticket_url" target="_blank" rel="noopener">tickets ↗</a>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- GALLERY -->
      <section id="gallery" class="section">
        <h2 class="section-head"><span>photos</span><span class="marker">❂</span></h2>
        <div v-if="photos.length === 0" class="panel muted">No photos up yet.</div>
        <div class="gallery">
          <figure v-for="ph in photos" :key="ph.id">
            <img :src="`/api/photos/${ph.id}/raw`" :alt="ph.caption" loading="lazy" />
            <figcaption v-if="ph.caption">{{ ph.caption }}</figcaption>
          </figure>
        </div>
      </section>

      <!-- FOOTER -->
      <footer class="footer">
        <div v-if="content.footer_text">{{ content.footer_text }}</div>
        <div style="margin-top:6px">
          &copy; {{ year }} Dogcatcher ·
          <router-link class="backstage-link" to="/backstage" title="staff only">·</router-link>
        </div>
      </footer>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api.js';

const content = ref({
  hero_tagline: '',
  about_body: '',
  journal_intro: '',
  shows_intro: '',
  footer_text: '',
});
const posts = ref([]);
const shows = ref([]);
const photos = ref([]);
const year = new Date().getFullYear();

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Struck-through, like a flyer someone's already crossed off —
// only kicks in when the sort key actually parses as a date.
function isPast(show) {
  if (!show || !show.sort_key) return false;
  const d = new Date(show.sort_key);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

onMounted(async () => {
  try {
    const [c, p, s, ph] = await Promise.all([
      api.get('/content'),
      api.get('/posts'),
      api.get('/shows'),
      api.get('/photos'),
    ]);
    content.value = { ...content.value, ...c };
    posts.value = p;
    shows.value = s;
    photos.value = ph;
  } catch (e) {
    console.error('Failed to load site content', e);
  }
});
</script>
