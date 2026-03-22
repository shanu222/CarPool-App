import { createBrowserRouter } from "react-router";
import { Onboarding } from "./pages/Onboarding";
import { Auth } from "./pages/Auth";
import { Home } from "./pages/Home";
import { SearchResults } from "./pages/SearchResults";
import { RideDetails } from "./pages/RideDetails";
import { PostRide } from "./pages/PostRide";
import { Booking } from "./pages/Booking";
import { MyTrips } from "./pages/MyTrips";
import { Chat } from "./pages/Chat";
import { Profile } from "./pages/Profile";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LiveMap } from "./pages/LiveMap";
import { AdminLogin } from "./pages/AdminLogin";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AdminProtectedRoute } from "./components/AdminProtectedRoute";
import { RideRequests } from "./pages/RideRequests";
import { RideRequestDetails } from "./pages/RideRequestDetails";
import { PostRequest } from "./pages/PostRequest";
import { Notifications } from "./pages/Notifications";
import { PaymentMethods } from "./pages/PaymentMethods";
import { Privacy } from "./pages/Privacy";
import { Support } from "./pages/Support";

const isAdminApp = import.meta.env.VITE_APP_MODE === "admin";

export const router = createBrowserRouter(
  isAdminApp
    ? [
        {
          path: "/",
          element: <AdminLogin />,
        },
        {
          path: "/auth",
          element: <AdminLogin />,
        },
        {
          element: <AdminProtectedRoute />,
          children: [
            {
              path: "/dashboard",
              element: <AdminDashboard />,
            },
          ],
        },
      ]
    : [
        {
          path: "/",
          element: <Onboarding />,
        },
        {
          path: "/auth",
          element: <Auth />,
        },
        {
          element: <ProtectedRoute />,
          children: [
            {
              path: "/map",
              element: <LiveMap />,
            },
            {
              element: <Layout />,
              children: [
                {
                  path: "/home",
                  element: <Home />,
                },
                {
                  path: "/search",
                  element: <SearchResults />,
                },
                {
                  path: "/ride/:id",
                  element: <RideDetails />,
                },
                {
                  path: "/post-ride",
                  element: <PostRide />,
                },
                {
                  path: "/post-request",
                  element: <PostRequest />,
                },
                {
                  path: "/ride-requests",
                  element: <RideRequests />,
                },
                {
                  path: "/requests/:id",
                  element: <RideRequestDetails />,
                },
                {
                  path: "/booking/:id",
                  element: <Booking />,
                },
                {
                  path: "/trips",
                  element: <MyTrips />,
                },
                {
                  path: "/chat/:id",
                  element: <Chat />,
                },
                {
                  path: "/profile",
                  element: <Profile />,
                },
                {
                  path: "/notifications",
                  element: <Notifications />,
                },
                {
                  path: "/payment-methods",
                  element: <PaymentMethods />,
                },
                {
                  path: "/privacy",
                  element: <Privacy />,
                },
                {
                  path: "/support",
                  element: <Support />,
                },
              ],
            },
          ],
        },
      ]
);
