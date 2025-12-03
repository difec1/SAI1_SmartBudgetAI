export default {
  routes: [
    {
      method: "POST",
      path: "/analyse-purchase",
      handler: "smartbudget.analysePurchase",
      config: {
        auth: false, // für den Anfang ohne Login; später kannst du auf "auth" umstellen
      },
    },
  ],
};
