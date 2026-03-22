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

export const router = createBrowserRouter([
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
        ],
      },
    ],
  },
]);
