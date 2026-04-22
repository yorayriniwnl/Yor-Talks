import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useStore } from "./store/index.js";
import { useSocket } from "./hooks/useSocket.js";
import { ErrorBoundary, OfflineBanner } from "./components/Shared.jsx";
import { Toast } from "./components/PostCard.jsx";
import Layout                  from "./components/Layout.jsx";
import { AuthScreen, HomeScreen, ExploreScreen, ReelsScreen, NotifsScreen, ProfileScreen, EditProfile, MessagesScreen, ChatScreen, SearchScreen, SavedScreen, ArchiveScreen, AnalyticsScreen, AdminScreen, HashtagScreen } from "./screens/AllScreens.jsx";
import PostScreen               from "./screens/PostScreen.jsx";
import OnboardingScreen         from "./screens/OnboardingScreen.jsx";
import SecurityScreen           from "./screens/SecurityScreen.jsx";
import SettingsScreen           from "./screens/SettingsScreen.jsx";
import FollowersScreen          from "./screens/FollowersScreen.jsx";
import LikersScreen             from "./screens/LikersScreen.jsx";
import CollectionsScreen        from "./screens/CollectionsScreen.jsx";
import CollectionDetailScreen   from "./screens/CollectionDetailScreen.jsx";
import ActivityScreen           from "./screens/ActivityScreen.jsx";

function SocketProvider() {
  const user = useStore(s => s.user);
  useSocket(user);
  return null;
}
function Guard({ children }) {
  const { user, authLoaded } = useStore();
  const loc = useLocation();
  if (!authLoaded) return (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#000",flexDirection:"column",gap:20 }}>
      <div style={{ fontSize:44,fontFamily:"'Dancing Script',cursive",fontWeight:700,background:"linear-gradient(45deg,#f09433,#dc2743,#bc1888)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>Yor Talks</div>
      <div className="spinner spinner-lg" />
    </div>
  );
  if (!user) return <Navigate to="/auth" state={{ from: loc }} replace />;
  return children;
}
function AppRoutes() {
  const { loadMe } = useStore();
  useEffect(() => { loadMe(); }, []);
  return (
    <>
      <SocketProvider /><OfflineBanner /><Toast />
      <Routes>
        <Route path="/auth"       element={<AuthScreen />} />
        <Route path="/onboarding" element={<Guard><OnboardingScreen /></Guard>} />
        <Route path="/" element={<Guard><Layout /></Guard>}>
          <Route index                           element={<HomeScreen />} />
          <Route path="explore"                  element={<ExploreScreen />} />
          <Route path="reels"                    element={<ReelsScreen />} />
          <Route path="search"                   element={<SearchScreen />} />
          <Route path="notifs"                   element={<NotifsScreen />} />
          <Route path="activity"                 element={<ActivityScreen />} />
          <Route path="messages"                 element={<MessagesScreen />} />
          <Route path="messages/:convId"         element={<ChatScreen />} />
          <Route path="profile"                  element={<ProfileScreen />} />
          <Route path="edit-profile"             element={<EditProfile />} />
          <Route path="saved"                    element={<SavedScreen />} />
          <Route path="collections"              element={<CollectionsScreen />} />
          <Route path="collections/:colId"       element={<CollectionDetailScreen />} />
          <Route path="archive"                  element={<ArchiveScreen />} />
          <Route path="analytics"               element={<AnalyticsScreen />} />
          <Route path="settings"                element={<SettingsScreen />} />
          <Route path="settings/security"       element={<SecurityScreen />} />
          <Route path="admin"                   element={<AdminScreen />} />
          <Route path="p/:postId"               element={<PostScreen />} />
          <Route path="p/:postId/likes"         element={<LikersScreen />} />
          <Route path="hashtag/:tag"            element={<HashtagScreen />} />
          <Route path=":username"               element={<ProfileScreen />} />
          <Route path=":username/followers"     element={<FollowersScreen type="followers" />} />
          <Route path=":username/following"     element={<FollowersScreen type="following" />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AppRoutes />
      </ErrorBoundary>
    </BrowserRouter>
  );
}
