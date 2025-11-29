const API_BASE_URL = "http://localhost:3000";

function setupForm() {
  const form = document.getElementById(
    "purchase-form"
  ) as HTMLFormElement | null;
  const amountInput = document.getElementById(
    "amount"
  ) as HTMLInputElement | null;
  const merchantInput = document.getElementById(
    "merchant"
  ) as HTMLInputElement | null;
  const descriptionInput = document.getElementById("description") as
    | HTMLTextAreaElement
    | HTMLInputElement
    | null;
  const chatHistory = document.getElementById("chat-history");
  const errorBox = document.getElementById("form-error");

  if (
    !form ||
    !amountInput ||
    !merchantInput ||
    !descriptionInput ||
    !chatHistory
  ) {
    console.warn("Formularelemente nicht gefunden, bitte ids pruefen.");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (errorBox) errorBox.textContent = "";

    const amountValue = amountInput.value.trim();
    const merchantValue = merchantInput.value.trim();
    const descriptionValue = descriptionInput.value.trim();

    if (!amountValue || !merchantValue || !descriptionValue) {
      if (errorBox) {
        errorBox.textContent = "Bitte alle Felder ausfuellen.";
      }
      return;
    }

    const amount = parseFloat(amountValue.replace(",", "."));
    if (Number.isNaN(amount) || amount <= 0) {
      if (errorBox) {
        errorBox.textContent =
          "Bitte einen gueltigen Betrag groesser als 0 eingeben.";
      }
      return;
    }

    const submitBtn = form.querySelector(
      "button[type='submit']"
    ) as HTMLButtonElement | null;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Analyse laeuft ...";
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/analysePurchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          merchant: merchantValue,
          description: descriptionValue,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Fehler bei der Analyse.");
      }

      const data = (await res.json()) as {
        aiText: string;
        decision: "PUSH_NEEDED" | "NO_PUSH";
      };

      const userBubble = document.createElement("div");
      userBubble.className = "chat-bubble user";
      userBubble.textContent = `Du moechtest ${amount.toFixed(
        2
      )} CHF bei ${merchantValue} fuer "${descriptionValue}" online ausgeben.`;

      const aiBubble = document.createElement("div");
      aiBubble.className = "chat-bubble ai";

      const aiText = document.createElement("div");
      aiText.textContent = data.aiText;

      const meta = document.createElement("div");
      meta.className =
        "chat-meta " +
        (data.decision === "PUSH_NEEDED" ? "push-needed" : "no-push");
      meta.textContent =
        data.decision === "PUSH_NEEDED"
          ? "Moeglicher Impulskauf – Push Benachrichtigung empfohlen."
          : "Keine Push Benachrichtigung noetig.";

      aiBubble.appendChild(aiText);
      aiBubble.appendChild(meta);

      chatHistory.appendChild(userBubble);
      chatHistory.appendChild(aiBubble);
      chatHistory.classList.remove("hidden");

      amountInput.value = "";
      merchantInput.value = "";
      descriptionInput.value = "";
    } catch (err: any) {
      console.error(err);
      if (errorBox) {
        errorBox.textContent =
          err?.message ?? "Unerwarteter Fehler bei der Analyse.";
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Einkauf analysieren";
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupForm();
});
