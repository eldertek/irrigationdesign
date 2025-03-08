<template>
  <div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
        404 - Page non trouvée
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        La page que vous recherchez n'existe pas ou a été déplacée.
      </p>
    </div>
    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
        <div class="text-center">
          <router-link
            to="/"
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Retour à l'accueil
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
// Pas besoin de logique supplémentaire pour cette vue
</script> 