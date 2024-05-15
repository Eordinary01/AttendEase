import { useEffect, useState } from "react";
import axios from "axios";


export default function TeacherDashboard(){

    const[tickets,setTickets] = useState({});

    useEffect(()=>{
        const fetchTickets = async()=>{
            try {
                const response = await axios.get("http://localhost:8011/api/tickets");
                setTickets(response.data);
                
            } catch (error) {
                console.error("Error fetching tickets:", error);
                
            }
        };
        fetchTickets();
    },[])

    return (
        <div>
      <h1>Teacher's Dashboard</h1>
      <h2>Tickets:</h2>
      <ul>
        {tickets.map((ticket) => (
          <li key={ticket._id}>
            Roll No: {ticket.rollNo}, Section: {ticket.section}, Document: {ticket.document}
          </li>
        ))}
      </ul>
    </div>
    );

}