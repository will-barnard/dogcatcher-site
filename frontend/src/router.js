import { createRouter, createWebHistory } from 'vue-router';
import PublicSite from './components/PublicSite.vue';
import Backstage from './components/Backstage.vue';

// The admin area lives at an unlisted route. It's intentionally not
// linked from the main nav — only a faint "·" in the footer points here.
const routes = [
  { path: '/', component: PublicSite },
  { path: '/backstage', component: Backstage },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

export default createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to) {
    if (to.hash) return { el: to.hash, top: 70 };
    return { top: 0 };
  },
});
