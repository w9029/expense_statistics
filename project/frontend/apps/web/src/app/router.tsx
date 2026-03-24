import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/layouts/app-layout";
import { PublicLayout } from "@/layouts/public-layout";
import {
  RedirectAuthenticated,
  RequireAuth,
} from "@/features/auth/auth-guard";
import { LandingPage } from "@/pages/landing-page";
import { LoginPage } from "@/pages/login-page";
import { RegisterPage } from "@/pages/register-page";
import { AccountBooksPage } from "@/pages/account-books-page";
import { AccountBookDetailPage } from "@/pages/account-book-detail-page";
import { ExpenseCategoriesPage } from "@/pages/expense-categories-page";
import { NormalExpensePage } from "@/pages/normal-expense-page";
import { MergedExpensePage } from "@/pages/merged-expense-page";
import { ProfilePage } from "@/pages/profile-page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <PublicLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      {
        element: <RedirectAuthenticated />,
        children: [
          { path: "auth/login", element: <LoginPage /> },
          { path: "auth/register", element: <RegisterPage /> },
        ],
      },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: "/app",
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/app/account-books" replace /> },
          { path: "account-books", element: <AccountBooksPage /> },
          { path: "account-books/:accountBookId", element: <AccountBookDetailPage /> },
          {
            path: "account-books/:accountBookId/categories",
            element: <ExpenseCategoriesPage />,
          },
          {
            path: "account-books/:accountBookId/expenses/new-normal",
            element: <NormalExpensePage />,
          },
          {
            path: "account-books/:accountBookId/expenses/new-merged",
            element: <MergedExpensePage />,
          },
          { path: "profile", element: <ProfilePage /> },
        ],
      },
    ],
  },
]);
