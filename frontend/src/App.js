import './App.css';
import Dashboard from './component/Dashboard';
import Ticket from './component/add-tickets';
// import Header from './component/header';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="ticket" element={<Ticket/>}/>
      </Routes>
    </Router>
  );
}

export default App;
