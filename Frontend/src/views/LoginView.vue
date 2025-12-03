<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();

const email = ref("");
const password = ref("");
const loading = ref(false);
const error = ref<string | null>(null);

// Strapi Anbindung kommt spaeter
const onSubmit = async () => {
  error.value = null;

  if (!email.value || !password.value) {
    error.value = "Bitte E Mail und Passwort eingeben.";
    return;
  }

  loading.value = true;
  try {
    // Platzhalter Login
    await new Promise((resolve) => setTimeout(resolve, 800));
    // spaeter: Strapi Login aufrufen und Token speichern
    router.push("/dashboard");
  } catch (e) {
    console.error(e);
    error.value = "Login fehlgeschlagen.";
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <main class="page">
    <div class="container">
      <h1 style="margin-bottom: 24px">Anmelden bei SmartBudgetAI</h1>

      <form @submit.prevent="onSubmit" style="max-width: 400px">
        <div class="form-group">
          <label for="email">E Mail</label>
          <input
            id="email"
            type="email"
            v-model="email"
            placeholder="name@beispiel.ch"
            required
          />
        </div>

        <div class="form-group">
          <label for="password">Passwort</label>
          <input
            id="password"
            type="password"
            v-model="password"
            placeholder="Passwort"
            required
          />
        </div>

        <button type="submit" class="submit-btn" :disabled="loading">
          {{ loading ? "Anmeldung läuft ..." : "Einloggen" }}
        </button>

        <p v-if="error" class="error" style="margin-top: 12px">
          {{ error }}
        </p>
      </form>
    </div>
  </main>
</template>
