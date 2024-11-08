import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './components/HomePage';
import CreateAccount from './components/CreateAccount';
import Navbar from './components/Navbar';

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <Navbar />
        <div className="pt-16">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/register" element={<CreateAccount />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;