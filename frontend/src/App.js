import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './components/HomePage';
import CreateAccount from './components/CreateAccount';
import Login from './components/Login';
import Navbar from './components/Navbar';
import Hub from './components/Hub';
import Lists from './components/Lists';
import CreateList from './components/CreateList';
import ListDetails from './components/ListDetails';
import NotFound from './components/NotFound';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/routes/ProtectedRoute';
import PublicOnlyRoute from './components/routes/PublicOnlyRoute';
import Search from './components/Search';
import JoinList from './components/JoinList';
import Roulette from './components/Roulette';
import Rankings from './components/Rankings';
import Profile from './components/Profile';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="App">
          <Navbar />
          <div className="pt-16">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route 
                path="/register" 
                element={
                  <PublicOnlyRoute>
                    <CreateAccount />
                  </PublicOnlyRoute>
                } 
              />
              <Route 
                path="/login" 
                element={
                  <PublicOnlyRoute>
                    <Login />
                  </PublicOnlyRoute>
                } 
              />
              <Route 
                path="/hub" 
                element={
                  <ProtectedRoute>
                    <Hub />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/search" 
                element={
                  <ProtectedRoute>
                    <Search />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/lists" 
                element={
                  <ProtectedRoute>
                    <Lists />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/lists/create"
                element={
                  <ProtectedRoute>
                    <CreateList />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/lists/:id"
                element={
                  <ProtectedRoute>
                    <ListDetails />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/lists/join"
                element={
                  <ProtectedRoute>
                    <JoinList />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/roulette"
                element={
                  <ProtectedRoute>
                    <Roulette />
                  </ProtectedRoute>
                }
              />
              <Route 
                path="/ratings"
                element={
                  <ProtectedRoute>
                    <Rankings />
                  </ProtectedRoute>
                }
              />
              <Route 
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;