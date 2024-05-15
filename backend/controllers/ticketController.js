

const Ticket = require("../models/Ticket");

const createTicket = async(req,res)=>{
    const{rollNo,section,document} = req.body;

    try{
        const newTicket = new Ticket({rollNo,section,document});
        await newTicket.save();

        res.status(201).json({message:"Ticket created successfully", ticket:newTicket});
    }
    catch (error) {
        console.error("Error creating ticket:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getTickets = async(req,res)=>{
    try {
        const tickets = await Ticket.find({});
        res.json(tickets);
        
    } catch (error) {
        console.error("Error fetching tickets:", error);
        res.status(500).json({ message: "Internal server error" });
        
    }
}

module.exports  ={
   createTicket,
   getTickets
} 