<script setup lang="ts">
import { ref } from "vue";
import { analyzePurchase } from "../services/smartBudgetService";
import { useRouter } from "vue-router";

const router = useRouter();

const goToLogin = () => {
  router.push("/login");
};

const amount = ref<number | null>(null);
const merchant = ref("");
const justification = ref("");

const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<any | null>(null);

const onSubmit = async () => {
  error.value = null;
  result.value = null;

  if (!amount.value || !merchant.value || !justification.value) {
    error.value = "Bitte alle Felder ausfüllen.";
    return;
  }

  loading.value = true;
  try {
    const response = await analyzePurchase({
      amount: amount.value,
      merchant: merchant.value,
      justification: justification.value,
    });
    result.value = response;
  } catch (e) {
    console.error(e);
    error.value = "Die Analyse ist fehlgeschlagen.";
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <main class="page">
    <!-- Hero Abschnitt -->
    <section class="hero">
      <div class="hero-content">
        <h1>Dein digitaler Budget-Coach für den Alltag</h1>

        <p class="hero-subtitle">
          SmartBudgetAI hilft dir, spontane Käufe zu hinterfragen und bewusster
          mit deinem Geld umzugehen.
        </p>

        <p class="hero-text">
          Im aktuellen Prototyp gibst du einzelne Einkäufe manuell ein und
          erhältst eine Einschätzung der KI. Später gelangst du von hier zum
          Login und zu deinem persönlichen Finanz-Dashboard.
        </p>

        <button type="button" class="hero-button" @click="goToLogin">
          Zum Login und Dashboard
        </button>
      </div>
    </section>

    <!-- Prototyp / Formular Abschnitt -->
    <section class="form-section">
      <h2>Einkauf analysieren</h2>

      <form class="justify-form" @submit.prevent="onSubmit">
        <label>
          Betrag (CHF)
          <input type="number" v-model.number="amount" min="0" step="0.05" />
        </label>

        <label>
          Händler
          <input type="text" v-model="merchant" />
        </label>

        <label>
          Begründung
          <textarea v-model="justification" rows="4"></textarea>
        </label>

        <button type="submit" :disabled="loading">
          {{ loading ? "Analysiere..." : "Kauf prüfen" }}
        </button>
      </form>

      <section v-if="error" class="error">
        {{ error }}
      </section>

      <section v-if="result" class="result">
        <h3>Ergebnis</h3>
        <pre>{{ result }}</pre>
      </section>
    </section>
  </main>
</template>

<style scoped>
.page {
  max-width: 960px;
  margin: 2rem auto;
  padding: 1.5rem;
}

/* Hero */

.hero {
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border-radius: 1.5rem;
  padding: 2.5rem 2rem;
  margin-bottom: 2.5rem;
}

.hero-content h1 {
  font-size: 2.2rem;
  margin-bottom: 1rem;
}

.hero-subtitle {
  font-size: 1.1rem;
  margin-bottom: 0.75rem;
  color: #4b5563;
}

.hero-text {
  font-size: 0.95rem;
  margin-bottom: 1.5rem;
  color: #6b7280;
}

.hero-button {
  padding: 0.85rem 1.8rem;
  border-radius: 0.75rem;
  border: none;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.95rem;
  background-color: #2563eb;
  color: #ffffff;
  transition: background-color 0.2s ease, transform 0.1s ease;
}

.hero-button:hover {
  background-color: #1d4ed8;
  transform: translateY(-1px);
}

.hero-button:active {
  transform: translateY(0);
}

/* Formular / Ergebnis */

.form-section {
  background: #ffffff;
  border-radius: 1.25rem;
  padding: 2rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08);
}

.form-section h2 {
  font-size: 1.4rem;
  margin-bottom: 1.25rem;
}

.justify-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

input,
textarea {
  width: 100%;
  padding: 0.7rem 0.9rem;
  border-radius: 0.5rem;
  border: 1px solid #d1d5db;
  font-size: 0.95rem;
}

input:focus,
textarea:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.18);
}

button[type="submit"] {
  align-self: flex-start;
  padding: 0.8rem 1.6rem;
  border-radius: 0.8rem;
  border: none;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.95rem;
  background-color: #111827;
  color: #ffffff;
  margin-top: 0.5rem;
}

button[type="submit"]:disabled {
  opacity: 0.7;
  cursor: default;
}

.error {
  margin-top: 1rem;
  color: #b91c1c;
}

.result {
  margin-top: 1.5rem;
  background: #f9fafb;
  padding: 1rem;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
}

.result h3 {
  margin-bottom: 0.5rem;
}
</style>
