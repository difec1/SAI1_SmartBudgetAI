<script setup lang="ts">
const categories = [
  "Einnahmen",
  "Zahlungen",
  "Mobilität",
  "Schopping",
  "Lebensmittel",
  "Gastronomie",
  "Unterhaltung",
  "Persoenliches",
  "Reisen",
  "Bargeldbezug",
  "Gesundheit",
  "Sparen und Anlegen",
  "Wohnen",
  "Steuern",
  "Allgemeines",
];

// später: echte Daten vom Backend
const totalIncome = 20033;
const totalSpending = 16686;
</script>

<template>
  <main
    class="page"
    style="background-color: var(--bg-light); min-height: 100vh"
  >
    <div class="container">
      <h1 class="section-title" style="text-align: left; margin-bottom: 24px">
        Finanzübersicht
      </h1>

      <section
        style="
          background: white;
          border-radius: 16px;
          padding: 24px 32px;
          box-shadow: var(--shadow-lg);
          margin-bottom: 32px;
        "
      >
        <h2 style="font-size: 20px; margin-bottom: 12px">Jahr 2021</h2>
        <p style="margin-bottom: 4px">
          <strong>Eingehend:</strong>
          {{ totalIncome.toLocaleString("de CH") }} CHF
        </p>
        <p>
          <strong>Ausgehend:</strong>
          {{ totalSpending.toLocaleString("de CH") }} CHF
        </p>
      </section>

      <section
        style="
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
        "
      >
        <div
          v-for="cat in categories"
          :key="cat"
          style="
            background: white;
            border-radius: 12px;
            padding: 16px 20px;
            box-shadow: var(--shadow-md);
            border: 1px solid var(--border-color);
          "
        >
          <h3 style="font-size: 16px; margin-bottom: 8px">{{ cat }}</h3>
          <p style="color: var(--text-light); font-size: 14px">
            Später: Ausgaben in dieser Kategorie, z.B. Balken oder
            Kuchendiagramm.
          </p>
        </div>
      </section>
    </div>
  </main>
</template>
