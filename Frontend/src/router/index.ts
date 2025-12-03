import { createRouter, createWebHistory } from "vue-router";
import SmartBudgetView from "../views/SmartBudgetView.vue";
import LoginView from "../views/LoginView.vue";
import DashboardView from "../views/DashboardView.vue";

const routes = [
  {
    path: "/",
    name: "landing",
    component: SmartBudgetView,
  },
  {
    path: "/login",
    name: "login",
    component: LoginView,
  },
  {
    path: "/dashboard",
    name: "dashboard",
    component: DashboardView,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
