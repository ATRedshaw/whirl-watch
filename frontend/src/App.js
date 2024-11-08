import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './components/HomePage';
import CreateAccount from './components/CreateAccount';

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          <Route exact path="/" element={<HomePage />} />
          <Route path="/register" element={<CreateAccount />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;