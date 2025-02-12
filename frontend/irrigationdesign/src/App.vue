<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import HelloWorld from './components/HelloWorld.vue'
</script>

<template>
  <div class="h-full">
    <header class="bg-white shadow">
      <nav class="mx-auto px-4 sm:px-6 lg:px-8" aria-label="Top">
        <div class="flex h-16 items-center justify-between">
          <div class="flex items-center">
            <router-link to="/" class="text-2xl font-bold text-primary-600">
              IrrigationDesign
            </router-link>
          </div>
          <div class="ml-10 space-x-4">
            <router-link
              to="/"
              class="text-base font-medium text-gray-500 hover:text-gray-900"
              active-class="text-primary-600"
            >
              Carte
            </router-link>
            <router-link
              to="/about"
              class="text-base font-medium text-gray-500 hover:text-gray-900"
              active-class="text-primary-600"
            >
              À propos
            </router-link>
          </div>
        </div>
      </nav>
    </header>

    <main class="h-[calc(100%-4rem)]">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
header {
  line-height: 1.5;
  max-height: 100vh;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

nav {
  width: 100%;
  font-size: 12px;
  text-align: center;
  margin-top: 2rem;
}

nav a.router-link-exact-active {
  color: var(--color-text);
}

nav a.router-link-exact-active:hover {
  background-color: transparent;
}

nav a {
  display: inline-block;
  padding: 0 1rem;
  border-left: 1px solid var(--color-border);
}

nav a:first-of-type {
  border: 0;
}

@media (min-width: 1024px) {
  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  .logo {
    margin: 0 2rem 0 0;
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }

  nav {
    text-align: left;
    margin-left: -1rem;
    font-size: 1rem;

    padding: 1rem 0;
    margin-top: 1rem;
  }
}
</style>
