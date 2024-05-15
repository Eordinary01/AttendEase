const User = require("../models/User");
const bcrypt = require("bcrypt")
const jwt = require('jsonwebtoken');
const register = async (req, res) => {
    const { name, email, password, section, role,rollNo } = req.body;

    try {
        let existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashPassword = await bcrypt.hash(password, 10);

        const newUser = new User({ name, email, password: hashPassword, section, role,rollNo });

        await newUser.save();

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const login = async(req,res)=>{
    const{email,password,section,role,rollNo} = req.body;

    try {
        const user = await User.findOne({email});

        if(!user){
            return res.status(404).json({ message: 'User not found' });
        }

        const isPasswordValid = await bcrypt.compare(password,user.password);

        if(!isPasswordValid){
            return res.status(401).json({ message: 'Invalid password' });
        }

        if (user.section !== section) {
            return res.status(401).json({ message: 'Invalid section' });
        }

        if (user.role !== role) {
            return res.status(401).json({ message: 'Invalid role' });
        }
        if(user.rollNo !== rollNo){
            return res.status(401).json({ message: 'Invalid rollNo' });

        }

        const token = jwt.sign({ userId: user._id }, 'eyJhbGciOiJIUzI1NiJ9.ew0KICAic3ViIjogIjEyMzQ1Njc4OTAiLA0KICAibmFtZSI6ICJBbmlzaCBOYXRoIiwNCiAgImlhdCI6IDE1MTYyMzkwMjINCn0.CMEx-YapnKFDaNDYw8nW9oEAWx8UXFdtEMQWspCMgyE', { expiresIn: '1h' });

        res.status(200).json({ token });
        
    } catch (error) {
        console.error('Error logging in user:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}


module.exports  ={
    register,
    login
}